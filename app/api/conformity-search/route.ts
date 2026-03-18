import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.SERPER_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "Serper ist nicht konfiguriert. Bitte SERPER_API_KEY als Umgebungsvariable setzen.",
        },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(request.url);
    const manufacturer = searchParams.get("manufacturer");
    const product = searchParams.get("product");

    if (!manufacturer || !product) {
      return NextResponse.json(
        {
          error:
            "Parameter 'manufacturer' und 'product' sind erforderlich",
        },
        { status: 400 }
      );
    }

    const query = `"${manufacturer}" "${product}" Konformitätserklärung filetype:pdf`;

    const response = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: query,
        num: 5,
        gl: "de",
        hl: "de",
      }),
    });

    if (!response.ok) {
      const errorData = await response.text().catch(() => "");
      console.error("Serper API Fehler:", response.status, errorData);
      return NextResponse.json(
        { error: `Serper API Fehler: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    const results = (data.organic || []).map(
      (item: {
        title: string;
        link: string;
        snippet: string;
      }) => ({
        title: item.title,
        url: item.link,
        snippet: item.snippet,
        fileFormat: item.link.toLowerCase().endsWith(".pdf") ? "PDF" : null,
      })
    );

    return NextResponse.json({
      results,
      totalResults: String(data.searchInformation?.totalResults || results.length),
    });
  } catch (error) {
    console.error("Conformity Search Fehler:", error);
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}
