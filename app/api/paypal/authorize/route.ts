import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createFlowToken, getPayPalConfig, isPayPalId, paypalRequest, stableRequestId, verifyFlowToken } from "@/lib/paypal";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const orderId = body.orderId;
    const claims = verifyFlowToken(body.flowToken);
    if (!claims || claims.stage !== "created" || claims.orderId !== orderId || !isPayPalId(orderId)) {
      return NextResponse.json({ error: "Invalid or expired ProofPay authorization flow." }, { status: 400 });
    }

    const config = getPayPalConfig();
    if (config.configured && !config.ready) {
      return NextResponse.json({ error: "PayPal Sandbox settings are incomplete or the client IDs do not match." }, { status: 503 });
    }

    if (claims.mode === "simulation") {
      if (config.ready) return NextResponse.json({ error: "Demo configuration changed; start a new milestone flow." }, { status: 409 });
      const authorizationId = `SIM-AUTH-${randomUUID()}`;
      const flowToken = createFlowToken({
        orderId: claims.orderId,
        amount: claims.amount,
        mode: claims.mode,
        stage: "authorized",
        authorizationId,
      });
      return NextResponse.json({ authorizationId, status: "AUTHORIZED", mode: "simulation", flowToken });
    }

    if (!config.ready) return NextResponse.json({ error: "PayPal Sandbox settings are unavailable for this flow." }, { status: 503 });
    const order = await paypalRequest<{
      status?: string;
      purchase_units?: Array<{ payments?: { authorizations?: Array<{ id?: string; status?: string }> } }>;
    }>(
      `/v2/checkout/orders/${encodeURIComponent(orderId)}/authorize`,
      "POST",
      {},
      stableRequestId(`authorize:${orderId}`),
    );
    const authorization = order.purchase_units?.[0]?.payments?.authorizations?.[0];
    if (!authorization?.id) throw new Error("PayPal did not return an authorization ID.");
    const flowToken = createFlowToken({
      orderId: claims.orderId,
      amount: claims.amount,
      mode: claims.mode,
      stage: "authorized",
      authorizationId: authorization.id,
    });
    return NextResponse.json({ authorizationId: authorization.id, status: authorization.status ?? order.status, mode: "sandbox", flowToken });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to authorize the PayPal Sandbox order.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
