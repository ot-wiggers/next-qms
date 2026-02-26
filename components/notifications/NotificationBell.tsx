"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";
import { NotificationCenter } from "./NotificationCenter";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const count = useQuery(api.notifications.unreadCount) as number | undefined;

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setOpen(true)}
      >
        <Bell className="h-5 w-5" />
        {(count ?? 0) > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
            {count! > 99 ? "99+" : count}
          </span>
        )}
        <span className="sr-only">Benachrichtigungen</span>
      </Button>
      <NotificationCenter open={open} onOpenChange={setOpen} />
    </>
  );
}
