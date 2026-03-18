import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.BRAVE_SEARCH_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "Brave Search ist nicht konfiguriert. Bitte BRAVE_SEARCH_API_KEY als Umgebungsvariable setzen.",
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

    const url = new URL("https://api.search.brave.com/res/v1/web/search");
    url.searchParams.set("q", query);
    url.searchParams.set("count", "5");

    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": apiKey,
      },
    });

    if (!response.ok) {
      const errorData = await response.text().catch(() => "");
      console.error("Brave Search API Fehler:", response.status, errorData);
      return NextResponse.json(
        { error: `Brave Search API Fehler: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    const results = (data.web?.results || []).map(
      (item: {
        title: string;
        url: string;
        description: string;
        extra_snippets?: string[];
      }) => ({
        title: item.title,
        url: item.url,
        snippet: item.description,
        fileFormat: item.url.toLowerCase().endsWith(".pdf") ? "PDF" : null,
      })
    );

    return NextResponse.json({
      results,
      totalResults: String(data.web?.total_count || results.length),
    });
  } catch (error) {
    console.error("Conformity Search Fehler:", error);
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}
