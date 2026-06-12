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
    title: "Qualitätsmanagementsystem",
    items: [
      { label: "Dokumente", href: "/documents", icon: FileText, permission: "documents:read" },
      { label: "Dokumenten-Graph", href: "/documents/graph", icon: GitBranch, permission: "documents:read" },
      { label: "Schulungen", href: "/trainings", icon: GraduationCap, permission: "trainings:list" },
      { label: "Schulungsanträge", href: "/training-requests", icon: MessageSquarePlus },
      { label: "Schulungsmatrix", href: "/training-matrix", icon: Grid3x3, permission: "trainingMatrix:list", featureFlag: "TRAINING_MATRIX" },
      { label: "Interne Audits", href: "/audits", icon: ClipboardCheck, featureFlag: "AUDITS", permission: "audits:list" },
      { label: "Auditplan", href: "/audits/plan", icon: CalendarRange, permission: "audits:list", featureFlag: "AUDITS" },
      { label: "CAPA", href: "/capa", icon: AlertTriangle, featureFlag: "CAPA", permission: "capa:list" },
      { label: "Reklamationen", href: "/complaints", icon: MessageSquarePlus, permission: "complaints:list", featureFlag: "COMPLAINTS" },
      { label: "Risikoregister", href: "/risks", icon: ShieldAlert, permission: "risks:list", featureFlag: "RISKS" },
      { label: "Qualitätsziele", href: "/quality-objectives", icon: Target, permission: "qualityObjectives:list", featureFlag: "QUALITY_OBJECTIVES" },
      { label: "Managementbewertung", href: "/management-review", icon: FileCheck, permission: "mgmtReview:list", featureFlag: "MGMT_REVIEW" },
      { label: "PMS-Bericht", href: "/pms-reports", icon: FileSearch, permission: "pmsReports:list", featureFlag: "PMS_REPORTS" },
    ],
  },
  {
    title: "MDR & Produkte",
    items: [
      { label: "Produkte", href: "/mdr/products", icon: Package, permission: "products:list" },
      { label: "Hersteller", href: "/mdr/manufacturers", icon: Factory, permission: "products:list" },
      { label: "Konformitätserklärungen", href: "/mdr/declarations", icon: Shield, permission: "declarations:list" },
      { label: "Hilfsmittelverzeichnis", href: "/mdr/hilfsmittelverzeichnis", icon: BookOpen, permission: "hmv:browse" },
      { label: "Versorgungsspektrum", href: "/mdr/versorgungsspektrum", icon: CheckSquare, permission: "hmv:browse" },
    ],
  },
  {
    title: "In Planung",
    items: [
      { label: "Wareneingang", href: "/incoming-goods", icon: Truck, featureFlag: "INCOMING_GOODS", badge: "IN PLANUNG" },
      { label: "Prüfmittel", href: "/devices", icon: Wrench, featureFlag: "DEVICES", badge: "IN PLANUNG" },
      { label: "Berichte", href: "/reports", icon: BarChart3, featureFlag: "REPORTS", badge: "IN PLANUNG" },
    ],
  },
  {
    title: "Einstellungen",
    items: [
      { label: "Benachrichtigungen", href: "/settings/notifications", icon: Bell },
    ],
  },
  {
    title: "Administration",
    items: [
      { label: "Verwaltung", href: "/admin", icon: Building2, permission: "users:list" },
      { label: "Einstellungen", href: "/admin/settings", icon: Settings, permission: "admin:settings" },
    ],
  },
];

/** Renders a single nav item. Feature-flag filtering is handled upstream in
 *  NavContent so section headings are only shown when there are visible items. */
function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const isActive = pathname === item.href ||
    (item.href !== "/" && pathname.startsWith(item.href));

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

  return (
    <ScrollArea className="h-full py-4">
      <div className="px-3 space-y-6">
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

          return (
            <div key={section.title}>
              <h3 className="mb-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {section.title}
              </h3>
              <div className="space-y-1">
                {permittedItems.map((item) => (
                  <NavLink key={item.href} item={item} pathname={pathname} />
                ))}
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
