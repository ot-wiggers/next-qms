import { NextResponse } from "next/server";

export async function GET() {
  try {
    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "SERPER_API_KEY nicht konfiguriert" },
        { status: 503 }
      );
    }

    const response = await fetch("https://google.serper.dev/account", {
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Serper API Fehler: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({
      balance: data.balance ?? 0,
      rateLimit: data.rateLimit ?? 0,
    });
  } catch {
    return NextResponse.json(
      { error: "Fehler beim Abrufen des Serper-Kontostands" },
      { status: 500 }
    );
  }
}
