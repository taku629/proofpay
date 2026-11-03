import { NextResponse } from "next/server";
import { getPayPalConfig } from "@/lib/paypal";

export const dynamic = "force-dynamic";

export async function GET() {
  const paypal = getPayPalConfig();
  const aiReady = Boolean(process.env.AI_API_KEY && process.env.AI_BASE_URL && process.env.AI_MODEL);
  return NextResponse.json({
    paypalReady: paypal.ready,
    paypalMisconfigured: paypal.configured && !paypal.ready,
    paypalClientId: paypal.clientId,
    aiReady,
    aiModel: aiReady ? process.env.AI_MODEL : null,
  });
}
