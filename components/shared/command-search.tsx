"use client";

import { useEffect, useState, useCallback } from "react";
import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "../../convex/_generated/api";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  FileText,
  GraduationCap,
  ClipboardList,
  Users,
} from "lucide-react";
import { DOCUMENT_TYPE_LABELS } from "@/lib/types/enums";

interface CommandSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandSearch({ open, onOpenChange }: CommandSearchProps) {
  const [search, setSearch] = useState("");
  const router = useRouter();

  const results = useQuery(
    api.search.globalSearch,
    search.trim().length >= 2 ? { query: search.trim() } : "skip"
  );

  const navigate = useCallback(
    (href: string) => {
      onOpenChange(false);
      setSearch("");
      router.push(href);
    },
    [onOpenChange, router]
  );

  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  const hasResults =
    results &&
    (results.documents.length > 0 ||
      results.trainings.length > 0 ||
      results.tasks.length > 0 ||
      results.users.length > 0);

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Suche"
      description="Dokumente, Schulungen, Aufgaben und Benutzer durchsuchen"
    >
      <CommandInput
        placeholder="Suchen..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        {search.trim().length < 2 ? (
          <CommandEmpty>
            Mindestens 2 Zeichen eingeben...
          </CommandEmpty>
        ) : !hasResults && results ? (
          <CommandEmpty>Keine Ergebnisse gefunden.</CommandEmpty>
        ) : null}

        {results && results.documents.length > 0 && (
          <CommandGroup heading="Dokumente">
            {results.documents.map((doc) => (
              <CommandItem
                key={doc._id}
                value={`doc-${doc.documentCode} ${doc.title}`}
                onSelect={() => navigate(`/documents/${doc._id}`)}
              >
                <FileText className="text-muted-foreground" />
                <div className="flex flex-1 items-center justify-between gap-2 min-w-0">
                  <div className="min-w-0">
                    <span className="font-medium">{doc.documentCode}</span>
                    {doc.title && (
                      <span className="ml-2 text-muted-foreground truncate">
                        {doc.title}
                      </span>
                    )}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {DOCUMENT_TYPE_LABELS[doc.documentType as keyof typeof DOCUMENT_TYPE_LABELS] ?? doc.documentType}
                    </span>
                  </div>
                  <StatusBadge status={doc.status} />
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {results && results.trainings.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Schulungen">
              {results.trainings.map((t) => (
                <CommandItem
                  key={t._id}
                  value={`training-${t.title}`}
                  onSelect={() => navigate(`/trainings/${t._id}`)}
                >
                  <GraduationCap className="text-muted-foreground" />
                  <div className="flex flex-1 items-center justify-between gap-2 min-w-0">
                    <span className="truncate">{t.title}</span>
                    <StatusBadge status={t.status} />
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {results && results.tasks.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Aufgaben">
              {results.tasks.map((t) => (
                <CommandItem
                  key={t._id}
                  value={`task-${t.title}`}
                  onSelect={() => navigate(`/tasks/${t._id}`)}
                >
                  <ClipboardList className="text-muted-foreground" />
                  <div className="flex flex-1 items-center justify-between gap-2 min-w-0">
                    <span className="truncate">{t.title}</span>
                    <StatusBadge status={t.status} />
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {results && results.users.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Benutzer">
              {results.users.map((u) => (
                <CommandItem
                  key={u._id}
                  value={`user-${u.firstName} ${u.lastName} ${u.email}`}
                  onSelect={() => navigate(`/admin/users`)}
                >
                  <Users className="text-muted-foreground" />
                  <div className="flex flex-1 items-center justify-between gap-2 min-w-0">
                    <span className="truncate">
                      {u.firstName} {u.lastName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {u.email}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
