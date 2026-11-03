import { createHmac, createHash, randomUUID, timingSafeEqual } from "node:crypto";

const PAYPAL_API = "https://api-m.sandbox.paypal.com";
const LOCAL_SIGNING_SECRET = "proofpay-local-demo-only-change-for-real-deployment";

export type PaymentMode = "sandbox" | "simulation";
export type FlowClaims = {
  v: 1;
  orderId: string;
  amount: string;
  mode: PaymentMode;
  stage: "created" | "authorized" | "settled";
  authorizationId?: string;
  decision?: "capture" | "void";
  issuedAt: number;
};

export function getPayPalConfig() {
  const clientId = process.env.PAYPAL_CLIENT_ID?.trim();
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim();
  const publicClientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID?.trim();
  const configured = Boolean(clientId || clientSecret || publicClientId);
  const ready = Boolean(clientId && clientSecret && publicClientId && clientId === publicClientId);
  return { configured, ready, clientId: ready ? publicClientId! : null };
}

function signingSecret() {
  return process.env.PROOFPAY_SIGNING_SECRET?.trim()
    || process.env.PAYPAL_CLIENT_SECRET?.trim()
    || LOCAL_SIGNING_SECRET;
}

export function createFlowToken(claims: Omit<FlowClaims, "v" | "issuedAt">, issuedAt = Math.floor(Date.now() / 1000)) {
  const payload: FlowClaims = { ...claims, v: 1, issuedAt };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", signingSecret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifyFlowToken(token: unknown): FlowClaims | null {
  if (typeof token !== "string" || token.length > 2500) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, providedSignature] = parts;
  const expectedSignature = createHmac("sha256", signingSecret()).update(encoded).digest();
  let actualSignature: Buffer;
  try { actualSignature = Buffer.from(providedSignature, "base64url"); } catch { return null; }
  if (actualSignature.length !== expectedSignature.length || !timingSafeEqual(actualSignature, expectedSignature)) return null;
  try {
    const claims = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as FlowClaims;
    const now = Math.floor(Date.now() / 1000);
    if (claims.v !== 1 || !isPayPalId(claims.orderId) || typeof claims.amount !== "string"
      || !/^\d{1,5}\.\d{2}$/.test(claims.amount)
      || (claims.mode !== "sandbox" && claims.mode !== "simulation")
      || !["created", "authorized", "settled"].includes(claims.stage)
      || !Number.isInteger(claims.issuedAt) || claims.issuedAt > now + 60 || now - claims.issuedAt > 24 * 60 * 60) return null;
    if (claims.stage !== "created" && !isPayPalId(claims.authorizationId)) return null;
    if (claims.stage === "settled" && claims.decision !== "capture" && claims.decision !== "void") return null;
    return claims;
  } catch {
    return null;
  }
}

export function stableRequestId(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

async function getAccessToken() {
  const { ready } = getPayPalConfig();
  const clientId = process.env.PAYPAL_CLIENT_ID?.trim();
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim();
  if (!ready || !clientId || !clientSecret) {
    throw new Error("PayPal Sandbox credentials are not configured consistently.");
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || typeof payload.access_token !== "string") {
    throw new Error("Could not authenticate with PayPal Sandbox. Check the Sandbox app credentials.");
  }
  return payload.access_token as string;
}

export async function paypalRequest<T>(path: string, method: "POST", body?: unknown, requestId: string = randomUUID()): Promise<T> {
  const accessToken = await getAccessToken();
  const response = await fetch(`${PAYPAL_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      "PayPal-Request-Id": requestId,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = Array.isArray(payload.details) ? payload.details[0]?.description : undefined;
    throw new Error(typeof detail === "string" ? detail : `PayPal Sandbox returned HTTP ${response.status}.`);
  }
  return payload as T;
}

export function isPayPalId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{4,128}$/.test(value);
}
