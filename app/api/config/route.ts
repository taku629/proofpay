import { NextResponse } from "next/server";
import { getPayPalConfig } from "@/lib/paypal";

export const dynamic = "force-dynamic";

export async function GET() {
  const paypal = getPayPalConfig();
  return NextResponse.json({
    paypalReady: paypal.ready,
    paypalMisconfigured: paypal.configured && !paypal.ready,
    paypalClientId: paypal.clientId,
  });
}
