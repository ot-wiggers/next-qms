import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { Construction } from "lucide-react";

interface PlaceholderPageProps {
  title: string;
  description: string;
  workflows?: string[];
  entities?: string[];
  expectedAvailability?: string;
}

export function PlaceholderPage({
  title,
  description,
  workflows,
  entities,
  expectedAvailability,
}: PlaceholderPageProps) {
  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        actions={
          <Badge variant="outline" className="text-sm">
            IN PLANUNG
          </Badge>
        }
      />

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Construction className="h-8 w-8 text-muted-foreground" />
            <div>
              <CardTitle>Modul in Entwicklung</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {workflows && workflows.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">Geplante Workflows</h4>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                {workflows.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {entities && entities.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">Geplante Entitäten</h4>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                {entities.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          {expectedAvailability && (
            <div>
              <h4 className="text-sm font-medium mb-2">Voraussichtliche Verfügbarkeit</h4>
              <p className="text-sm text-muted-foreground">{expectedAvailability}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
