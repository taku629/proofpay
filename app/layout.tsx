import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ProofPay — Proof, before payment",
  description: "Agree on milestone criteria, review evidence with AI, and keep a person in control of PayPal Sandbox payment decisions.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
