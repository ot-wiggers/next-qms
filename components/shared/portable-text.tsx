import { PortableText as SanityPortableText } from "@portabletext/react";

interface PortableTextRendererProps {
  value: any[];
}

export function PortableTextRenderer({ value }: PortableTextRendererProps) {
  if (!value || value.length === 0) {
    return <p className="text-sm text-muted-foreground">Kein Inhalt vorhanden</p>;
  }

  return (
    <div className="prose prose-sm max-w-none dark:prose-invert">
      <SanityPortableText value={value} />
    </div>
  );
}
