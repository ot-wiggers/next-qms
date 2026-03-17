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

      // Filter by parentId client-side if provided
      if (parentId) {
        data = data.filter(
          (item: { parentId: string | null }) => item.parentId === parentId
        );
      }

      return NextResponse.json(data);
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
