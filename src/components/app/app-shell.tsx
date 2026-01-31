"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Paintbrush,
  LayoutGrid,
  Settings,
  ChevronLeft,
  ChevronRight,
  UserCircle,
  Calendar,
  Shield,
} from "lucide-react";

interface AppShellProps {
  children: React.ReactNode;
  user: {
    id: string;
    email: string;
    fullName: string;
  };
  company: {
    id: string;
    name: string;
    themeId: string;
  };
  isOwner: boolean;
  isSuperAdmin?: boolean;
}

// All nav items
const allNavItems = [
  { href: "/app/board", label: "Board", icon: LayoutGrid, ownerOnly: false, adminOnly: false },
  { href: "/app/schedule", label: "Schedule", icon: Calendar, ownerOnly: false, adminOnly: false },
  { href: "/app/customers", label: "Customers", icon: UserCircle, ownerOnly: false, adminOnly: false },
  { href: "/app/settings", label: "Settings", icon: Settings, ownerOnly: true, adminOnly: false },
  { href: "/app/admin", label: "Admin", icon: Shield, ownerOnly: false, adminOnly: true },
];

export function AppShell({ children, company, isOwner, isSuperAdmin = false }: AppShellProps) {
  // Filter nav items based on ownership and admin status
  const navItems = allNavItems.filter(item => {
    if (item.adminOnly) return isSuperAdmin;
    if (item.ownerOnly) return isOwner;
    return true;
  });
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", company.themeId);
  }, [company.themeId]);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden max-w-full">
      {/* Desktop sidebar */}
      <aside className={cn(
        "fixed left-0 top-0 z-40 hidden h-screen border-r bg-muted/50 lg:block transition-all duration-300",
        sidebarCollapsed ? "w-16" : "w-64"
      )}>
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center gap-2 border-b px-4 justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shrink-0">
                <Paintbrush className="h-5 w-5 text-primary-foreground" />
              </div>
              {!sidebarCollapsed && (
                <span className="text-lg font-bold truncate">{company.name}</span>
              )}
            </div>
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors shrink-0"
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {sidebarCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* Nav */}
          <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={sidebarCollapsed ? item.label : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    sidebarCollapsed && "justify-center"
                  )}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  {!sidebarCollapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </nav>

        </div>
      </aside>

      {/* Mobile header */}
      <header className="flex h-14 items-center justify-between border-b bg-background px-4 lg:hidden w-full max-w-full overflow-hidden">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shrink-0">
            <Paintbrush className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-bold truncate">{company.name}</span>
        </div>
      </header>

      {/* Main content */}
      <main className={cn(
        "min-h-screen pb-16 lg:pt-0 lg:pb-0 transition-all duration-300 w-full max-w-full overflow-x-hidden",
        sidebarCollapsed ? "lg:pl-16" : "lg:pl-64"
      )}>{children}</main>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t bg-background/95 backdrop-blur-sm safe-area-inset-bottom lg:hidden w-full max-w-full overflow-hidden">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 min-w-0 flex-1",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              <span className="text-[10px] font-medium truncate w-full text-center">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

