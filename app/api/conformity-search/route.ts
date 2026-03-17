import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;
    const cx = process.env.GOOGLE_CUSTOM_SEARCH_CX;

    if (!apiKey || !cx) {
      return NextResponse.json(
        {
          error:
            "Google Custom Search ist nicht konfiguriert. Bitte GOOGLE_CUSTOM_SEARCH_API_KEY und GOOGLE_CUSTOM_SEARCH_CX als Umgebungsvariablen setzen.",
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
    const url = new URL("https://www.googleapis.com/customsearch/v1");
    url.searchParams.set("key", apiKey);
    url.searchParams.set("cx", cx);
    url.searchParams.set("q", query);
    url.searchParams.set("num", "5");

    const response = await fetch(url.toString());

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error("Google Search API Fehler:", errorData);
      return NextResponse.json(
        { error: `Google Search API Fehler: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    const results = (data.items || []).map(
      (item: {
        title: string;
        link: string;
        snippet: string;
        fileFormat?: string;
      }) => ({
        title: item.title,
        url: item.link,
        snippet: item.snippet,
        fileFormat: item.fileFormat || null,
      })
    );

    return NextResponse.json({
      results,
      totalResults: data.searchInformation?.totalResults || "0",
    });
  } catch (error) {
    console.error("Conformity Search Fehler:", error);
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}
