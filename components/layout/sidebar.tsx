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
  CalendarRange,
  Settings,
  Shield,
  ShieldAlert,
  BookOpen,
  CheckSquare,
  AlertTriangle,
  Bell,
  ClipboardCheck,
  Factory,
  FileSearch,
  GitBranch,
  Truck,
  Wrench,
  BarChart3,
  MessageSquarePlus,
  Building2,
  Menu,
  Target,
  FileCheck,
  Grid3x3,
  ChevronDown,
  ListChecks,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { usePermissions } from "@/lib/hooks/usePermissions";
import type { PermissionAction } from "@/lib/types/domain";
import { useEffect, useState } from "react";

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
    // Fix sichtbar, ohne Überschrift, nicht einklappbar
    title: "",
    items: [
      { label: "Dashboard", href: "/", icon: LayoutDashboard },
      { label: "Aufgaben", href: "/tasks", icon: ClipboardList },
      { label: "Kalender", href: "/calendar", icon: Calendar },
    ],
  },
  {
    title: "Dokumente",
    items: [
      { label: "Dokumente", href: "/documents", icon: FileText, permission: "documents:read" },
      { label: "Dokumenten-Graph", href: "/documents/graph", icon: GitBranch, permission: "documents:read" },
      { label: "Berichte", href: "/reports", icon: BarChart3, featureFlag: "REPORTS", permission: "reports:list" },
    ],
  },
  {
    title: "Schulungen",
    items: [
      { label: "Schulungen", href: "/trainings", icon: GraduationCap, permission: "trainings:list" },
      { label: "Schulungsanträge", href: "/training-requests", icon: MessageSquarePlus },
      { label: "Schulungsmatrix", href: "/training-matrix", icon: Grid3x3, permission: "trainingMatrix:list", featureFlag: "TRAINING_MATRIX" },
    ],
  },
  {
    title: "Audits & Maßnahmen",
    items: [
      { label: "Interne Audits", href: "/audits", icon: ClipboardCheck, featureFlag: "AUDITS", permission: "audits:list" },
      { label: "Auditplan", href: "/audits/plan", icon: CalendarRange, permission: "audits:list", featureFlag: "AUDITS" },
      { label: "Checklisten-Vorlage", href: "/audits/templates", icon: ListChecks, permission: "audits:manage", featureFlag: "AUDITS" },
      { label: "CAPA", href: "/capa", icon: AlertTriangle, featureFlag: "CAPA", permission: "capa:list" },
      { label: "Reklamationen", href: "/complaints", icon: MessageSquarePlus, permission: "complaints:list", featureFlag: "COMPLAINTS" },
    ],
  },
  {
    title: "QM-Steuerung",
    items: [
      { label: "Risikoregister", href: "/risks", icon: ShieldAlert, permission: "risks:list", featureFlag: "RISKS" },
      { label: "Qualitätsziele", href: "/quality-objectives", icon: Target, permission: "qualityObjectives:list", featureFlag: "QUALITY_OBJECTIVES" },
      { label: "Managementbewertung", href: "/management-review", icon: FileCheck, permission: "mgmtReview:list", featureFlag: "MGMT_REVIEW" },
      { label: "PMS-Bericht", href: "/pms-reports", icon: FileSearch, permission: "pmsReports:list", featureFlag: "PMS_REPORTS" },
    ],
  },
  {
    title: "Produkte & MDR",
    items: [
      { label: "Produkte", href: "/mdr/products", icon: Package, permission: "products:list" },
      { label: "Hersteller", href: "/mdr/manufacturers", icon: Factory, permission: "products:list" },
      { label: "Konformitätserklärungen", href: "/mdr/declarations", icon: Shield, permission: "declarations:list" },
      { label: "Hilfsmittelverzeichnis", href: "/mdr/hilfsmittelverzeichnis", icon: BookOpen, permission: "hmv:browse" },
      { label: "Versorgungsspektrum", href: "/mdr/versorgungsspektrum", icon: CheckSquare, permission: "hmv:browse" },
    ],
  },
  {
    title: "Prüfungen",
    items: [
      { label: "Wareneingang", href: "/incoming-goods", icon: Truck, featureFlag: "INCOMING_GOODS", permission: "incomingGoods:list" },
      { label: "Prüfmittel", href: "/devices", icon: Wrench, featureFlag: "DEVICES", permission: "devices:list" },
    ],
  },
  {
    title: "System",
    items: [
      { label: "Benachrichtigungen", href: "/settings/notifications", icon: Bell },
      { label: "Verwaltung", href: "/admin", icon: Building2, permission: "users:list" },
      { label: "Einstellungen", href: "/admin/settings", icon: Settings, permission: "admin:settings" },
    ],
  },
];

const SIDEBAR_STORAGE_KEY = "qms-sidebar-open-groups";

function isItemActive(item: NavItem, pathname: string): boolean {
  return pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
}

/** Renders a single nav item. Feature-flag filtering is handled upstream in
 *  NavContent so section headings are only shown when there are visible items. */
function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const isActive = isItemActive(item, pathname);

  return (
    <Link
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
}

function NavContent() {
  const pathname = usePathname();
  const { can } = usePermissions();
  const flags = useQuery(api.featureFlags.list, {});
  const enabledFlags = new Set(
    (flags ?? []).filter((f) => f.enabled).map((f) => f.key)
  );

  // Offene Gruppen: Default alle offen; localStorage erst nach Mount lesen
  // (vermeidet SSR-Hydration-Mismatch)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try {
      setOpenGroups(JSON.parse(window.localStorage.getItem(SIDEBAR_STORAGE_KEY) ?? "{}"));
    } catch {
      // korrupter Eintrag → Default (alle offen)
    }
  }, []);

  // Gruppe mit aktiver Route immer aufklappen.
  // openGroups gehört in die Deps: beim initialen Laden committed der
  // Load-Effekt den localStorage-Stand erst nach dem ersten Render — ohne
  // Re-Run bliebe eine eingeklappt gespeicherte aktive Gruppe zu.
  // Der ===false-Guard verhindert Endlosschleifen.
  useEffect(() => {
    const activeSection = navSections.find(
      (s) => s.title !== "" && s.items.some((i) => isItemActive(i, pathname))
    );
    if (activeSection && openGroups[activeSection.title] === false) {
      setOpenGroups((prev) => {
        const next = { ...prev, [activeSection.title]: true };
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    }
  }, [pathname, openGroups]);

  function toggleGroup(title: string) {
    setOpenGroups((prev) => {
      const next = { ...prev, [title]: !(prev[title] ?? true) };
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  return (
    <ScrollArea className="h-full py-4">
      <div className="px-3 space-y-4">
        <div className="px-3">
          <h2 className="text-lg font-semibold tracking-tight">QMS</h2>
          <p className="text-xs text-muted-foreground">Qualitätsmanagementsystem</p>
        </div>
        {navSections.map((section) => {
          const permittedItems = section.items.filter((item) => {
            if (item.permission && !can(item.permission as PermissionAction)) return false;
            if (item.featureFlag && !enabledFlags.has(item.featureFlag)) return false;
            return true;
          });
          if (permittedItems.length === 0) return null;

          // Fixe Top-Gruppe ohne Überschrift
          if (section.title === "") {
            return (
              <div key="top" className="space-y-1">
                {permittedItems.map((item) => (
                  <NavLink key={item.href} item={item} pathname={pathname} />
                ))}
              </div>
            );
          }

          const isOpen = openGroups[section.title] ?? true;

          return (
            <div key={section.title}>
              <button
                type="button"
                onClick={() => toggleGroup(section.title)}
                className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
                aria-expanded={isOpen}
              >
                {section.title}
                <ChevronDown
                  className={cn("h-3.5 w-3.5 transition-transform", !isOpen && "-rotate-90")}
                />
              </button>
              {isOpen && (
                <div className="mt-1 space-y-1">
                  {permittedItems.map((item) => (
                    <NavLink key={item.href} item={item} pathname={pathname} />
                  ))}
                </div>
              )}
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
