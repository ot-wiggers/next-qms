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
      const results: Array<{
        id: string;
        parentId: string | null;
        displayValue: string;
        xSteller: string;
        level: number;
      }> = [];

      // Search across levels 1-4 (but limit per level for performance)
      for (const lvl of [1, 2, 3, 4]) {
        try {
          const response = await fetch(
            `${BASE_URL}/VerzeichnisTree/${lvl}`,
            { next: { revalidate: 86400 } }
          );
          if (!response.ok) continue;

          const data = await response.json();
          const matches = data
            .filter((item: { level: number; displayValue: string; xSteller: string }) =>
              item.level === lvl && (
                item.xSteller.includes(term) ||
                item.displayValue.toLowerCase().includes(termLower)
              )
            )
            .slice(0, 20);

          results.push(...matches);
          if (results.length >= 50) break;
        } catch {
          continue;
        }
      }

      return NextResponse.json(results.slice(0, 50));
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
