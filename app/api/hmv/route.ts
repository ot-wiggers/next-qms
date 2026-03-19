import { NextRequest, NextResponse } from "next/server";

const BASE_URL =
  "https://hilfsmittel-api.gkv-spitzenverband.de/api/verzeichnis";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    if (!action) {
      return NextResponse.json(
        { error: "Parameter 'action' ist erforderlich" },
        { status: 400 }
      );
    }

    if (action === "tree") {
      const level = searchParams.get("level");
      const parentId = searchParams.get("parentId");

      if (!level || !["1", "2", "3", "4"].includes(level)) {
        return NextResponse.json(
          { error: "Parameter 'level' muss zwischen 1 und 4 liegen" },
          { status: 400 }
        );
      }

      const response = await fetch(
        `${BASE_URL}/VerzeichnisTree/${level}`,
        { next: { revalidate: 86400 } }
      );

      if (!response.ok) {
        return NextResponse.json(
          { error: `REHADAT API Fehler: ${response.status}` },
          { status: response.status }
        );
      }

      let data = await response.json();

      const numLevel = parseInt(level);

      // CRITICAL: Filter to only return items of the REQUESTED level
      // The API returns all items from level 1 up to the requested level
      data = data.filter(
        (item: { level: number; parentId: string | null }) => item.level === numLevel
      );

      // Further filter by parentId if provided
      if (parentId) {
        data = data.filter(
          (item: { parentId: string | null }) => item.parentId === parentId
        );
      }

      return NextResponse.json(data);
    }

    if (action === "search") {
      const term = searchParams.get("term");
      if (!term || term.length < 2) {
        return NextResponse.json(
          { error: "Parameter 'term' muss mindestens 2 Zeichen lang sein" },
          { status: 400 }
        );
      }

      const termLower = term.toLowerCase();

      // Unified result type for both tree items and products
      interface SearchResult {
        id: string;
        parentId: string | null;
        displayValue: string;
        xSteller: string;
        level: number;
        herstellerName?: string;
        isProduct?: boolean;
      }

      const results: SearchResult[] = [];

      // Fetch level 4 data once (it includes the most specific tree categories + product keywords)
      // Next.js caches this with revalidate: 86400
      let lvl4Data: Array<{
        id: string;
        parentId: string | null;
        displayValue: string;
        xSteller: string;
        level: number;
        keywords: string | null;
      }> = [];

      try {
        const lvl4Response = await fetch(
          `${BASE_URL}/VerzeichnisTree/4`,
          { next: { revalidate: 86400 } }
        );
        if (lvl4Response.ok) {
          lvl4Data = await lvl4Response.json();
        }
      } catch {
        // Continue without level 4 data
      }

      // Phase 1: Search tree levels 1-4 with BIDIRECTIONAL matching
      // Level 4 response already contains ALL levels 1-4, so we can search them all at once
      if (lvl4Data.length > 0) {
        for (const lvl of [4, 3, 2, 1]) {
          const matches = lvl4Data
            .filter((item) => {
              if (item.level !== lvl) return false;
              return (
                item.xSteller.includes(term) ||
                term.includes(item.xSteller) ||
                item.displayValue.toLowerCase().includes(termLower)
              );
            })
            .slice(0, 15);

          results.push(...matches.map((m) => ({
            id: m.id,
            parentId: m.parentId,
            displayValue: m.displayValue,
            xSteller: m.xSteller,
            level: m.level,
          })));
          if (results.length >= 30) break;
        }
      }

      // Phase 2: Search product-level data from level 4 keywords
      // Level 4 entries contain a 'keywords' field with all individual products
      // Format: "10.50.04.1200 Rollator Migo 2G 723 600 000 Drive Medical GmbH"
      for (const item of lvl4Data) {
        if (item.level !== 4 || !item.keywords) continue;
        const lines = item.keywords.split(/[\r\n]+/);
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          const spaceIdx = trimmed.indexOf(" ");
          if (spaceIdx < 0) continue;
          const productNumber = trimmed.substring(0, spaceIdx);
          const productInfo = trimmed.substring(spaceIdx + 1).trim();
          if (productInfo === "Nicht besetzt") continue;

          const matchesNumber =
            productNumber.includes(term) || term.includes(productNumber);
          const matchesName = productInfo.toLowerCase().includes(termLower);

          if (matchesNumber || matchesName) {
            results.push({
              id: `product-${productNumber}`,
              parentId: item.id,
              displayValue: `${productNumber} - ${productInfo}`,
              xSteller: productNumber,
              level: 5,
              herstellerName: undefined,
              isProduct: true,
            });
            if (results.length >= 50) break;
          }
        }
        if (results.length >= 50) break;
      }

      // Sort: most specific (highest level) first, then by relevance
      results.sort((a, b) => {
        // Exact xSteller match first
        if (a.xSteller === term && b.xSteller !== term) return -1;
        if (b.xSteller === term && a.xSteller !== term) return 1;
        // Then by level (most specific first)
        return b.level - a.level;
      });

      return NextResponse.json(results.slice(0, 50));
    }

    if (action === "productByNumber") {
      const number = searchParams.get("number");
      if (!number) {
        return NextResponse.json(
          { error: "Parameter 'number' ist erforderlich" },
          { status: 400 }
        );
      }

      try {
        const response = await fetch(
          `${BASE_URL}/Produkt`,
          { next: { revalidate: 86400 } }
        );
        if (!response.ok) {
          return NextResponse.json(
            { error: `REHADAT API Fehler: ${response.status}` },
            { status: response.status }
          );
        }

        const products = await response.json();
        const match = products.find(
          (p: { zehnSteller: string; istHerausgenommen: boolean }) =>
            p.zehnSteller === number && !p.istHerausgenommen
        );

        if (!match) {
          return NextResponse.json(
            { error: "Produkt nicht gefunden" },
            { status: 404 }
          );
        }

        return NextResponse.json(match);
      } catch {
        return NextResponse.json(
          { error: "Fehler beim Laden der Produktdaten" },
          { status: 500 }
        );
      }
    }

    if (action === "product") {
      const productId = searchParams.get("productId");

      if (!productId) {
        return NextResponse.json(
          { error: "Parameter 'productId' ist erforderlich" },
          { status: 400 }
        );
      }

      const response = await fetch(
        `${BASE_URL}/Produkt/${productId}`,
        { next: { revalidate: 86400 } }
      );

      if (!response.ok) {
        return NextResponse.json(
          { error: `REHADAT API Fehler: ${response.status}` },
          { status: response.status }
        );
      }

      const data = await response.json();
      return NextResponse.json(data);
    }

    if (action === "products") {
      const response = await fetch(
        `${BASE_URL}/Produkt`,
        { next: { revalidate: 86400 } }
      );

      if (!response.ok) {
        return NextResponse.json(
          { error: `REHADAT API Fehler: ${response.status}` },
          { status: response.status }
        );
      }

      const data = await response.json();
      return NextResponse.json(data);
    }

    return NextResponse.json(
      { error: `Unbekannte Aktion: ${action}` },
      { status: 400 }
    );
  } catch (error) {
    console.error("HMV API Fehler:", error);
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}
