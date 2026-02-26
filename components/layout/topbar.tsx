"use client";

import { useState, useEffect } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogOut, User, Search } from "lucide-react";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { initials, fullName } from "@/lib/utils/formatting";
import { USER_ROLE_LABELS } from "@/lib/types/enums";
import type { UserRole } from "@/lib/types/enums";
import { MobileSidebar } from "./sidebar";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { CommandSearch } from "@/components/shared/command-search";
import { toast } from "sonner";

export function Topbar() {
  const { user } = useCurrentUser();
  const { signOut } = useAuthActions();
  const updateSelf = useMutation(api.users.updateSelf);

  const [searchOpen, setSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
  });

  // Cmd+K / Ctrl+K to open search
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const openProfile = () => {
    if (!user) return;
    setProfileForm({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
    });
    setProfileOpen(true);
  };

  const handleProfileSave = async () => {
    try {
      await updateSelf({
        firstName: profileForm.firstName,
        lastName: profileForm.lastName,
        email: profileForm.email,
      });
      toast.success("Profil aktualisiert");
      setProfileOpen(false);
    } catch (err: any) {
      toast.error(err.message ?? "Fehler beim Aktualisieren");
    }
  };

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center gap-4 border-b bg-background px-4 lg:px-6">
      <MobileSidebar />

      <div className="flex-1" />

      {user && (
        <>
          <Button
            variant="outline"
            className="hidden h-9 w-64 justify-start gap-2 text-sm text-muted-foreground sm:flex"
            onClick={() => setSearchOpen(true)}
          >
            <Search className="h-4 w-4" />
            <span>Suchen...</span>
            <kbd className="pointer-events-none ml-auto inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              <span className="text-xs">⌘</span>K
            </kbd>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="sm:hidden"
            onClick={() => setSearchOpen(true)}
          >
            <Search className="h-5 w-5" />
            <span className="sr-only">Suchen</span>
          </Button>
          <CommandSearch open={searchOpen} onOpenChange={setSearchOpen} />
          <NotificationBell />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="text-xs">
                    {initials(user.firstName, user.lastName)}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{fullName(user.firstName, user.lastName)}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {USER_ROLE_LABELS[user.role as UserRole] ?? user.role}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={openProfile}>
                <User className="mr-2 h-4 w-4" />
                Profil bearbeiten
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => signOut()}>
                <LogOut className="mr-2 h-4 w-4" />
                Abmelden
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Profil bearbeiten</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Vorname</Label>
                  <Input
                    value={profileForm.firstName}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, firstName: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nachname</Label>
                  <Input
                    value={profileForm.lastName}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, lastName: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>E-Mail</Label>
                  <Input
                    type="email"
                    value={profileForm.email}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, email: e.target.value })
                    }
                  />
                </div>
                <Button className="w-full" onClick={handleProfileSave}>
                  Änderungen speichern
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </header>
  );
}
