import { NextRequest, NextResponse } from "next/server";

interface SerperResult {
  title: string;
  link: string;
  snippet: string;
}

interface MappedResult {
  title: string;
  url: string;
  snippet: string;
  fileFormat: string | null;
}

async function serperSearch(apiKey: string, query: string, num = 5): Promise<SerperResult[]> {
  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q: query, num, gl: "de", hl: "de" }),
  });

  if (!response.ok) {
    const errorData = await response.text().catch(() => "");
    console.error("Serper API Fehler:", response.status, errorData);
    throw new Error(`Serper API Fehler: ${response.status}`);
  }

  const data = await response.json();
  return data.organic || [];
}

function mapResults(items: SerperResult[]): MappedResult[] {
  return items.map((item) => {
    const urlLower = item.link.toLowerCase();
    const isPdf = urlLower.endsWith(".pdf") || urlLower.includes(".pdf?");
    return {
      title: item.title,
      url: item.link,
      snippet: item.snippet,
      fileFormat: isPdf ? "PDF" : null,
    };
  });
}

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
    const site = searchParams.get("site");

    if (!manufacturer || !product) {
      return NextResponse.json(
        {
          error:
            "Parameter 'manufacturer' und 'product' sind erforderlich",
        },
        { status: 400 }
      );
    }

    // Build search queries — use both German and English terms
    // since manufacturers often publish DoCs in English
    const conformityTerms = '(Konformitätserklärung OR "Declaration of Conformity" OR DoC)';

    let pdfQuery: string;
    let fallbackQuery: string;

    if (site) {
      // Extract domain from URL for site-scoped search
      let domain: string;
      try {
        domain = new URL(site).hostname;
      } catch {
        domain = site.replace(/^https?:\/\//, "").split("/")[0];
      }
      // Phase 1: PDF only on manufacturer site
      pdfQuery = `site:${domain} ${product} ${conformityTerms} filetype:pdf`;
      // Phase 2: Any page on manufacturer site (fallback)
      fallbackQuery = `site:${domain} ${product} ${conformityTerms}`;
    } else {
      // Phase 1: PDF only across the web
      pdfQuery = `"${manufacturer}" ${product} ${conformityTerms} filetype:pdf`;
      // Phase 2: Any page across the web (fallback)
      fallbackQuery = `"${manufacturer}" ${product} ${conformityTerms}`;
    }

    // Phase 1: Search for PDFs first (most relevant for DoC)
    const pdfResults = mapResults(await serperSearch(apiKey, pdfQuery, 5));

    // Phase 2: If few PDF results, also search without filetype restriction
    let webResults: MappedResult[] = [];
    if (pdfResults.length < 3) {
      const rawWeb = await serperSearch(apiKey, fallbackQuery, 5);
      webResults = mapResults(rawWeb);
    }

    // Merge: PDFs first, then web results (deduplicated)
    const seenUrls = new Set<string>();
    const merged: MappedResult[] = [];

    // Add all PDF results first
    for (const r of pdfResults) {
      if (!seenUrls.has(r.url)) {
        seenUrls.add(r.url);
        merged.push(r);
      }
    }

    // Then add web results that are not duplicates
    // Prioritize PDFs found in web results too
    const webPdfs = webResults.filter((r) => r.fileFormat === "PDF");
    const webOther = webResults.filter((r) => r.fileFormat !== "PDF");

    for (const r of webPdfs) {
      if (!seenUrls.has(r.url)) {
        seenUrls.add(r.url);
        merged.push(r);
      }
    }
    for (const r of webOther) {
      if (!seenUrls.has(r.url)) {
        seenUrls.add(r.url);
        merged.push(r);
      }
    }

    return NextResponse.json({
      results: merged.slice(0, 10),
      totalResults: String(merged.length),
    });
  } catch (error) {
    console.error("Conformity Search Fehler:", error);
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}
