import { NextRequest, NextResponse } from "next/server";
import { analyzePdfText } from "@/lib/pdf/mdr-checklist";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pdfUrl = searchParams.get("url");

    if (!pdfUrl) {
      return NextResponse.json(
        { error: "Parameter 'url' ist erforderlich" },
        { status: 400 }
      );
    }

    // Validate URL
    try {
      const parsed = new URL(pdfUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        throw new Error("Invalid protocol");
      }
    } catch {
      return NextResponse.json(
        { error: "Ungültige URL" },
        { status: 400 }
      );
    }

    // Fetch the PDF
    const response = await fetch(pdfUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; QMS-Bot/1.0)",
        "Accept": "application/pdf,*/*",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `PDF nicht erreichbar: HTTP ${response.status}` },
        { status: response.status }
      );
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("pdf") && !pdfUrl.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json(
        { error: "Die URL liefert keine PDF-Datei" },
        { status: 400 }
      );
    }

    // Read PDF buffer
    const buffer = Buffer.from(await response.arrayBuffer());

    // Limit: don't process PDFs > 10MB
    if (buffer.length > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "PDF zu groß (max. 10 MB)" },
        { status: 413 }
      );
    }

    // pdf-parse v1: import lib directly to avoid test-file loading in index.js
    const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default;
    const pdfData = await pdfParse(buffer);

    const result = analyzePdfText(pdfData.text, pdfData.numpages);

    return NextResponse.json(result);
  } catch (error: any) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      return NextResponse.json(
        { error: "Zeitüberschreitung beim Laden der PDF" },
        { status: 504 }
      );
    }
    console.error("PDF Analysis Fehler:", error);
    return NextResponse.json(
      { error: "Fehler bei der PDF-Analyse" },
      { status: 500 }
    );
  }
}
