import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createFlowToken, getPayPalConfig, paypalRequest } from "@/lib/paypal";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 120) : "Freelance milestone";
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount < 1 || amount > 10000) {
      return NextResponse.json({ error: "Enter an amount from $1 to $10,000 USD." }, { status: 400 });
    }

    const config = getPayPalConfig();
    if (config.configured && !config.ready) {
      return NextResponse.json({ error: "PayPal Sandbox settings are incomplete or the client IDs do not match." }, { status: 503 });
    }

    const value = amount.toFixed(2);
    const mode = config.ready ? "sandbox" : "simulation";
    let id: string;
    if (config.ready) {
      const order = await paypalRequest<{ id?: string }>("/v2/checkout/orders", "POST", {
        intent: "AUTHORIZE",
        purchase_units: [
          {
            reference_id: "proofpay-milestone",
            description: `${title} — ProofPay Sandbox milestone`,
            amount: { currency_code: "USD", value },
          },
        ],
      });
      if (!order.id) throw new Error("PayPal Sandbox did not return an order ID.");
      id = order.id;
    } else {
      id = `SIM-${randomUUID()}`;
    }

    const flowToken = createFlowToken({ orderId: id, amount: value, mode, stage: "created" });
    return NextResponse.json({ id, mode, flowToken });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create the Sandbox authorization.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
