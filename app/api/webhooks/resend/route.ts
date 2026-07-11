import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json();

  // Resend webhook handler — extend with signature verification in production
  console.log("[Resend webhook]", body.type, body.data?.email_id);

  return NextResponse.json({ received: true });
}
