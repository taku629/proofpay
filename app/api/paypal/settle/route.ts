import { NextResponse } from "next/server";
import { createFlowToken, getPayPalConfig, paypalRequest, stableRequestId, verifyFlowToken } from "@/lib/paypal";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const decision = body.decision;
    if (decision !== "capture" && decision !== "void") {
      return NextResponse.json({ error: "Choose capture or void." }, { status: 400 });
    }
    const claims = verifyFlowToken(body.flowToken);
    if (!claims || claims.stage !== "authorized" || !claims.authorizationId) {
      return NextResponse.json({ error: "Invalid or expired ProofPay authorization flow." }, { status: 400 });
    }

    const config = getPayPalConfig();
    if (config.configured && !config.ready) {
      return NextResponse.json({ error: "PayPal Sandbox settings are incomplete or the client IDs do not match." }, { status: 503 });
    }

    let status: string;
    if (claims.mode === "simulation") {
      if (config.ready) return NextResponse.json({ error: "Demo configuration changed; start a new milestone flow." }, { status: 409 });
      status = decision === "capture" ? "CAPTURED" : "VOIDED";
    } else {
      if (!config.ready) return NextResponse.json({ error: "PayPal Sandbox settings are unavailable for this flow." }, { status: 503 });
      const path = decision === "capture"
        ? `/v2/payments/authorizations/${encodeURIComponent(claims.authorizationId)}/capture`
        : `/v2/payments/authorizations/${encodeURIComponent(claims.authorizationId)}/void`;
      const result = await paypalRequest<{ status?: string }>(
        path,
        "POST",
        decision === "capture" ? {} : undefined,
        stableRequestId(`${decision}:${claims.authorizationId}`),
      );
      status = result.status ?? (decision === "capture" ? "CAPTURED" : "VOIDED");
    }

    const flowToken = createFlowToken({
      orderId: claims.orderId,
      amount: claims.amount,
      mode: claims.mode,
      stage: "settled",
      authorizationId: claims.authorizationId,
      decision,
    });
    return NextResponse.json({ status, mode: claims.mode, flowToken });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update the PayPal Sandbox authorization.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
