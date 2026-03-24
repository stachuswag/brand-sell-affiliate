import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/hooks/useNotifications";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  LayoutDashboard,
  Users,
  Link2,
  UserCheck,
  BarChart2,
  Bell,
  LogOut,
  Menu,
  ChevronRight,
  Building2,
  LayoutTemplate,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";

const adminNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/partners", label: "Partnerzy", icon: Users },
  { href: "/offers", label: "Oferty", icon: Building2 },
  { href: "/links", label: "Linki afiliacyjne", icon: Link2 },
  { href: "/landing-pages", label: "Landing Pages", icon: LayoutTemplate },
  { href: "/contacts", label: "Kontakty / Leady", icon: UserCheck },
  { href: "/reports", label: "Raporty", icon: BarChart2 },
  { href: "/send-files", label: "Wyślij pliki", icon: Send },
  { href: "/agents", label: "Konta agentów", icon: UserCheck },
];

const agentNavItems = [
  { href: "/agent", label: "Mój panel", icon: LayoutDashboard },
];

function NavContent({ onClose }: { onClose?: () => void }) {
  const location = useLocation();
  const { role, user, signOut } = useAuth();

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Building2 className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-bold text-sidebar-foreground leading-none">Brand and Sell</p>
          <p className="text-xs text-sidebar-foreground/60 mt-0.5">System afiliacyjny</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {(role === "agent" ? agentNavItems : adminNavItems).map(({ href, label, icon: Icon }) => {
          const active = location.pathname === href;
          return (
            <Link
              key={href}
              to={href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {label}
              {active && <ChevronRight className="ml-auto h-3 w-3 opacity-60" />}
            </Link>
          );
        })}
      </nav>

      {/* User info */}
      <div className="border-t border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-accent text-sidebar-accent-foreground text-xs font-bold">
            {user?.email?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-sidebar-foreground truncate">{user?.email}</p>
            <p className="text-xs text-sidebar-foreground/60">
              {role === "admin" ? "Administrator" : role === "agent" ? "Agent" : "Pracownik"}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={signOut}
          className="w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <LogOut className="h-4 w-4" />
          Wyloguj się
        </Button>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { unreadCount, notifications, markAllRead } = useNotifications();

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 bg-sidebar shrink-0">
        <NavContent />
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3 h-14 shrink-0">
          <div className="flex items-center gap-3">
            {/* Mobile menu */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-64 bg-sidebar border-sidebar-border">
                <NavContent onClose={() => setMobileOpen(false)} />
              </SheetContent>
            </Sheet>
            <span className="font-semibold text-sm text-foreground lg:hidden">Brand and Sell</span>
          </div>

          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
              <div className="flex items-center justify-between px-3 py-2 border-b">
                <p className="text-sm font-semibold">Powiadomienia</p>
                {unreadCount > 0 && (
                  <Button variant="ghost" size="sm" className="h-auto py-0.5 px-2 text-xs" onClick={markAllRead}>
                    Oznacz jako przeczytane
                  </Button>
                )}
              </div>
              {notifications.length === 0 ? (
                <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                  Brak powiadomień
                </div>
              ) : (
                notifications.slice(0, 10).map((n) => (
                  <DropdownMenuItem key={n.id} className="flex flex-col items-start gap-0.5 px-3 py-2.5 cursor-default">
                    <div className="flex items-center gap-2 w-full">
                      {!n.is_read && <span className="h-2 w-2 rounded-full bg-accent flex-shrink-0" />}
                      <p className={cn("text-xs font-medium", !n.is_read ? "text-foreground" : "text-muted-foreground")}>
                        {n.title}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground pl-4">{n.message}</p>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
