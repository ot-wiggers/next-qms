"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  GraduationCap,
  Package,
  ClipboardList,
  Calendar,
  Users,
  Settings,
  Shield,
  AlertTriangle,
  ClipboardCheck,
  Truck,
  Wrench,
  BarChart3,
  MessageSquarePlus,
  Building2,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { useFeatureFlag } from "@/lib/hooks/useFeatureFlag";
import { useState } from "react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  permission?: string;
  featureFlag?: string;
  badge?: string;
}

const navSections: { title: string; items: NavItem[] }[] = [
  {
    title: "Übersicht",
    items: [
      { label: "Dashboard", href: "/", icon: LayoutDashboard },
      { label: "Aufgaben", href: "/tasks", icon: ClipboardList },
      { label: "Kalender", href: "/calendar", icon: Calendar },
    ],
  },
  {
    title: "QM-Dokumente",
    items: [
      { label: "Dokumente", href: "/documents", icon: FileText, permission: "documents:read" },
    ],
  },
  {
    title: "Schulungen",
    items: [
      { label: "Schulungen", href: "/trainings", icon: GraduationCap, permission: "trainings:list" },
      { label: "Schulungsanträge", href: "/training-requests", icon: MessageSquarePlus },
    ],
  },
  {
    title: "MDR & Produkte",
    items: [
      { label: "Produkte", href: "/mdr/products", icon: Package, permission: "products:list" },
      { label: "Konformitätserklärungen", href: "/mdr/declarations", icon: Shield, permission: "declarations:list" },
    ],
  },
  {
    title: "In Planung",
    items: [
      { label: "Interne Audits", href: "/audits", icon: ClipboardCheck, featureFlag: "AUDITS", badge: "IN PLANUNG" },
      { label: "CAPA", href: "/capa", icon: AlertTriangle, featureFlag: "CAPA", badge: "IN PLANUNG" },
      { label: "Reklamationen", href: "/complaints", icon: MessageSquarePlus, featureFlag: "COMPLAINTS", badge: "IN PLANUNG" },
      { label: "Wareneingang", href: "/incoming-goods", icon: Truck, featureFlag: "INCOMING_GOODS", badge: "IN PLANUNG" },
      { label: "Prüfmittel", href: "/devices", icon: Wrench, featureFlag: "DEVICES", badge: "IN PLANUNG" },
      { label: "Berichte", href: "/reports", icon: BarChart3, featureFlag: "REPORTS", badge: "IN PLANUNG" },
    ],
  },
  {
    title: "Administration",
    items: [
      { label: "Benutzer", href: "/admin/users", icon: Users, permission: "users:list" },
      { label: "Organisationen", href: "/admin/organizations", icon: Building2, permission: "admin:settings" },
      { label: "Standorte", href: "/admin/locations", icon: Settings, permission: "admin:settings" },
      { label: "Abteilungen", href: "/admin/departments", icon: Settings, permission: "admin:settings" },
      { label: "Einstellungen", href: "/admin/settings", icon: Settings, permission: "admin:settings" },
    ],
  },
];

function NavContent() {
  const pathname = usePathname();
  const { can } = usePermissions();

  return (
    <ScrollArea className="h-full py-4">
      <div className="px-3 space-y-6">
        <div className="px-3">
          <h2 className="text-lg font-semibold tracking-tight">QMS</h2>
          <p className="text-xs text-muted-foreground">Qualitätsmanagementsystem</p>
        </div>
        {navSections.map((section) => {
          const visibleItems = section.items.filter((item) => {
            if (item.permission && !can(item.permission as any)) return false;
            return true;
          });
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.title}>
              <h3 className="mb-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {section.title}
              </h3>
              <div className="space-y-1">
                {visibleItems.map((item) => {
                  const isActive = pathname === item.href ||
                    (item.href !== "/" && pathname.startsWith(item.href));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                      {item.badge && (
                        <Badge variant="outline" className="ml-auto text-[10px] px-1.5 py-0">
                          {item.badge}
                        </Badge>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:border-r bg-background">
      <NavContent />
    </aside>
  );
}

export function MobileSidebar() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Menü öffnen</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0">
        <NavContent />
      </SheetContent>
    </Sheet>
  );
}
