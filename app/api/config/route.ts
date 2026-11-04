import { NextResponse } from "next/server";
import { getPayPalConfig } from "@/lib/paypal";

export const dynamic = "force-dynamic";

export async function GET() {
  const paypal = getPayPalConfig();
  const geminiDemoReady = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_FREE_TIER_CONFIRMED === "true" && process.env.GEMINI_PROJECT_ID?.trim());
  return NextResponse.json({
    paypalReady: paypal.ready,
    paypalMisconfigured: paypal.configured && !paypal.ready,
    paypalClientId: paypal.clientId,
    geminiDemoReady,
  });
}
