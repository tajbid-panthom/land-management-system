import { NextResponse } from "next/server";

export async function GET() {
  const key = process.env.NEXT_PUBLIC_MAPTILER_KEY?.trim();
  if (!key) {
    return NextResponse.json({
      ok: false,
      reason: "missing",
      message: "NEXT_PUBLIC_MAPTILER_KEY is not set in .env.local",
    });
  }

  try {
    const res = await fetch(
      `https://api.maptiler.com/maps/streets-v2/style.json?key=${key}`,
      { next: { revalidate: 300 } },
    );

    if (res.ok) {
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({
      ok: false,
      reason: "forbidden",
      status: res.status,
      message:
        res.status === 403
          ? "MapTiler rejected the API key. Copy a fresh key from cloud.maptiler.com/account/keys/, update .env.local, and restart pnpm dev."
          : `MapTiler returned HTTP ${res.status}`,
    });
  } catch {
    return NextResponse.json({
      ok: false,
      reason: "network",
      message: "Could not reach MapTiler. Check your internet connection.",
    });
  }
}
