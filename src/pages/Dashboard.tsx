import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import {
  Link2,
  Users,
  UserCheck,
  TrendingUp,
  Clock,
  ArrowRight,
  Building2,
} from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";

interface DashboardStats {
  totalLinks: number;
  activeLinks: number;
  contactsThisMonth: number;
  closedDeals: number;
  totalPartners: number;
  recentContacts: Array<{
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    status: string;
    created_at: string;
    affiliate_links: { tracking_code: string; partners: { name: string } | null } | null;
  }>;
}

const statusConfig = {
  new: { label: "Nowy", className: "bg-blue-100 text-blue-800 border-blue-200" },
  in_progress: { label: "W trakcie", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  deal_closed: { label: "Transakcja", className: "bg-green-100 text-green-800 border-green-200" },
  no_deal: { label: "Brak transakcji", className: "bg-red-100 text-red-800 border-red-200" },
};

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalLinks: 0,
    activeLinks: 0,
    contactsThisMonth: 0,
    closedDeals: 0,
    totalPartners: 0,
    recentContacts: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [linksRes, activeLinksRes, contactsMonthRes, dealsRes, partnersRes, recentRes] = await Promise.all([
        supabase.from("affiliate_links").select("id", { count: "exact" }),
        supabase.from("affiliate_links").select("id", { count: "exact" }).eq("is_active", true),
        supabase.from("contacts").select("id", { count: "exact" }).gte("created_at", startOfMonth),
        supabase.from("contacts").select("id", { count: "exact" }).eq("status", "deal_closed"),
        supabase.from("partners").select("id", { count: "exact" }).eq("is_active", true),
        supabase
          .from("contacts")
          .select(`
            id, full_name, email, phone, status, created_at,
            affiliate_links (
              tracking_code,
              partners ( name )
            )
          `)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      setStats({
        totalLinks: linksRes.count ?? 0,
        activeLinks: activeLinksRes.count ?? 0,
        contactsThisMonth: contactsMonthRes.count ?? 0,
        closedDeals: dealsRes.count ?? 0,
        totalPartners: partnersRes.count ?? 0,
        recentContacts: (recentRes.data as any[]) ?? [],
      });
      setLoading(false);
    };

    fetchStats();
  }, [user]);

  const statCards = [
    {
      title: "Aktywne linki",
      value: stats.activeLinks,
      sub: `${stats.totalLinks} łącznie`,
      icon: Link2,
      href: "/links",
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      title: "Kontakty w tym miesiącu",
      value: stats.contactsThisMonth,
      sub: "od początku miesiąca",
      icon: UserCheck,
      href: "/contacts",
      color: "text-gold",
      bg: "bg-accent/10",
    },
    {
      title: "Zamknięte transakcje",
      value: stats.closedDeals,
      sub: "łącznie",
      icon: TrendingUp,
      href: "/reports",
      color: "text-success",
      bg: "bg-success/10",
    },
    {
      title: "Aktywni partnerzy",
      value: stats.totalPartners,
      sub: "firm partnerskich",
      icon: Users,
      href: "/partners",
      color: "text-foreground",
      bg: "bg-muted",
    },
  ];

  return (
    <AppShell>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {format(new Date(), "EEEE, d MMMM yyyy", { locale: pl })}
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Building2 className="h-4 w-4" />
            Brand and Sell
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {statCards.map(({ title, value, sub, icon: Icon, href, color, bg }) => (
            <Link key={href} to={href}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer group">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
                      <p className={`text-3xl font-bold mt-1 ${color}`}>
                        {loading ? "—" : value}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{sub}</p>
                    </div>
                    <div className={`rounded-xl p-2.5 ${bg} group-hover:scale-110 transition-transform`}>
                      <Icon className={`h-5 w-5 ${color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Recent contacts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold">Ostatnie kontakty</CardTitle>
            <Link to="/contacts" className="flex items-center gap-1 text-xs text-primary hover:underline">
              Zobacz wszystkie <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="px-6 py-8 text-center text-sm text-muted-foreground">Ładowanie...</div>
            ) : stats.recentContacts.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-muted-foreground">
                Brak kontaktów. Poczekaj aż ktoś skontaktuje się przez link afiliacyjny.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {stats.recentContacts.map((contact) => {
                  const s = statusConfig[contact.status as keyof typeof statusConfig];
                  return (
                    <Link
                      key={contact.id}
                      to="/contacts"
                      className="flex items-center justify-between px-6 py-3.5 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold flex-shrink-0">
                          {contact.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{contact.full_name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {contact.affiliate_links?.partners?.name && (
                              <span className="text-xs text-muted-foreground">
                                via {contact.affiliate_links.partners.name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${s?.className}`}>
                          {s?.label}
                        </span>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {format(new Date(contact.created_at), "d MMM", { locale: pl })}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
