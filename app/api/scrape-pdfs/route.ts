// app/api/scrape-pdfs/route.ts
import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

interface PdfLink {
  url: string;
  text: string;
  context: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pageUrl = searchParams.get("url");
    const productName = searchParams.get("product") ?? "";

    if (!pageUrl) {
      return NextResponse.json(
        { error: "Parameter 'url' ist erforderlich" },
        { status: 400 }
      );
    }

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(pageUrl);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        throw new Error("Invalid protocol");
      }
    } catch {
      return NextResponse.json(
        { error: "Ungültige URL" },
        { status: 400 }
      );
    }

    // Fetch the page
    const response = await fetch(pageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; QMS-Bot/1.0)",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Seite nicht erreichbar: HTTP ${response.status}` },
        { status: response.status }
      );
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      return NextResponse.json(
        { error: "Seite liefert kein HTML" },
        { status: 400 }
      );
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract all links to PDF files
    const pdfLinks: PdfLink[] = [];
    const seenUrls = new Set<string>();

    $("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      if (!href) return;

      // Resolve relative URLs
      let absoluteUrl: string;
      try {
        absoluteUrl = new URL(href, pageUrl).toString();
      } catch {
        return;
      }

      // Check if it's a PDF
      const isLikelyPdf =
        absoluteUrl.toLowerCase().endsWith(".pdf") ||
        absoluteUrl.toLowerCase().includes(".pdf?") ||
        absoluteUrl.toLowerCase().includes("/pdf/");

      if (!isLikelyPdf) return;
      if (seenUrls.has(absoluteUrl)) return;
      seenUrls.add(absoluteUrl);

      // Get link text and surrounding context
      const linkText = $(el).text().trim();
      const parentText = $(el).parent().text().trim().slice(0, 200);

      pdfLinks.push({
        url: absoluteUrl,
        text: linkText || absoluteUrl.split("/").pop() || "PDF",
        context: parentText,
      });
    });

    // Also check for iframe/embed/object sources pointing to PDFs
    $("iframe[src], embed[src], object[data]").each((_, el) => {
      const src = $(el).attr("src") || $(el).attr("data");
      if (!src) return;

      let absoluteUrl: string;
      try {
        absoluteUrl = new URL(src, pageUrl).toString();
      } catch {
        return;
      }

      if (
        absoluteUrl.toLowerCase().endsWith(".pdf") ||
        absoluteUrl.toLowerCase().includes(".pdf?")
      ) {
        if (!seenUrls.has(absoluteUrl)) {
          seenUrls.add(absoluteUrl);
          pdfLinks.push({
            url: absoluteUrl,
            text: "Eingebettetes PDF",
            context: "",
          });
        }
      }
    });

    // Score and sort: prioritize DoC/conformity-related PDFs
    const docKeywords = [
      "conformity", "konformität", "doc", "declaration", "erklärung",
      "ce", "mdr", "certificate", "zertifikat",
    ];
    const productLower = productName.toLowerCase();

    const scored = pdfLinks.map((link) => {
      let score = 0;
      const combined = `${link.text} ${link.context} ${link.url}`.toLowerCase();

      for (const kw of docKeywords) {
        if (combined.includes(kw)) score += 2;
      }
      if (productLower && combined.includes(productLower)) score += 3;

      return { ...link, score };
    });

    scored.sort((a, b) => b.score - a.score);

    return NextResponse.json({
      pdfs: scored.slice(0, 20),
      pageTitle: $("title").text().trim(),
      totalFound: scored.length,
    });
  } catch (error: any) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      return NextResponse.json(
        { error: "Zeitüberschreitung beim Laden der Seite" },
        { status: 504 }
      );
    }
    console.error("Scrape Fehler:", error);
    return NextResponse.json(
      { error: "Fehler beim Durchsuchen der Website" },
      { status: 500 }
    );
  }
}
