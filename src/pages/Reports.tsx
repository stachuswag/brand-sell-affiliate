import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, TrendingUp, Euro, Users, CheckCircle2 } from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";

interface PartnerReport {
  partner_id: string;
  partner_name: string;
  total_contacts: number;
  closed_deals: number;
  total_deal_value: number;
  total_commission: number;
  unpaid_commission: number;
}

export default function Reports() {
  const [reports, setReports] = useState<PartnerReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("all");

  const getPeriodDates = () => {
    const now = new Date();
    switch (period) {
      case "this_month": return { from: startOfMonth(now).toISOString(), to: endOfMonth(now).toISOString() };
      case "last_month": return { from: startOfMonth(subMonths(now, 1)).toISOString(), to: endOfMonth(subMonths(now, 1)).toISOString() };
      case "last_3": return { from: startOfMonth(subMonths(now, 3)).toISOString(), to: now.toISOString() };
      default: return null;
    }
  };

  const fetchReports = async () => {
    setLoading(true);
    const dates = getPeriodDates();

    // Fetch all partners
    const { data: partners } = await supabase.from("partners").select("id, name").eq("is_active", true);
    if (!partners) { setLoading(false); return; }

    const reportData: PartnerReport[] = await Promise.all(
      partners.map(async (partner) => {
        // Get contacts via affiliate links for this partner
        const linksQuery = await supabase.from("affiliate_links").select("id").eq("partner_id", partner.id);
        const linkIds = linksQuery.data?.map((l) => l.id) ?? [];

        if (linkIds.length === 0) {
          return {
            partner_id: partner.id,
            partner_name: partner.name,
            total_contacts: 0,
            closed_deals: 0,
            total_deal_value: 0,
            total_commission: 0,
            unpaid_commission: 0,
          };
        }

        let contactsQuery = supabase.from("contacts").select("id, status", { count: "exact" }).in("affiliate_link_id", linkIds);
        if (dates) contactsQuery = contactsQuery.gte("created_at", dates.from).lte("created_at", dates.to);
        const { count: totalContacts } = await contactsQuery;

        let txQuery = supabase.from("transactions").select("deal_value, commission_amount, commission_paid").in("affiliate_link_id", linkIds);
        if (dates) txQuery = txQuery.gte("created_at", dates.from).lte("created_at", dates.to);
        const { data: txData } = await txQuery;

        const closedDeals = txData?.length ?? 0;
        const totalDealValue = txData?.reduce((s, t) => s + (t.deal_value ?? 0), 0) ?? 0;
        const totalCommission = txData?.reduce((s, t) => s + (t.commission_amount ?? 0), 0) ?? 0;
        const unpaidCommission = txData?.filter((t) => !t.commission_paid).reduce((s, t) => s + (t.commission_amount ?? 0), 0) ?? 0;

        return {
          partner_id: partner.id,
          partner_name: partner.name,
          total_contacts: totalContacts ?? 0,
          closed_deals: closedDeals,
          total_deal_value: totalDealValue,
          total_commission: totalCommission,
          unpaid_commission: unpaidCommission,
        };
      })
    );

    setReports(reportData);
    setLoading(false);
  };

  useEffect(() => { fetchReports(); }, [period]);

  const totals = reports.reduce(
    (acc, r) => ({
      contacts: acc.contacts + r.total_contacts,
      deals: acc.deals + r.closed_deals,
      dealValue: acc.dealValue + r.total_deal_value,
      commission: acc.commission + r.total_commission,
      unpaid: acc.unpaid + r.unpaid_commission,
    }),
    { contacts: 0, deals: 0, dealValue: 0, commission: 0, unpaid: 0 }
  );

  const exportCSV = () => {
    const headers = ["Partner", "Kontakty", "Transakcje", "Wartość (PLN)", "Prowizja (PLN)", "Nieopłacona prowizja (PLN)"];
    const rows = reports.map((r) => [
      r.partner_name,
      r.total_contacts,
      r.closed_deals,
      r.total_deal_value.toFixed(2),
      r.total_commission.toFixed(2),
      r.unpaid_commission.toFixed(2),
    ]);
    const csv = [headers, ...rows].map((r) => r.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `raport-afiliacyjny-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(n);

  return (
    <AppShell>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Raporty i prowizje</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Zestawienie wyników partnerów</p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Cały czas</SelectItem>
                <SelectItem value="this_month">Ten miesiąc</SelectItem>
                <SelectItem value="last_month">Poprzedni miesiąc</SelectItem>
                <SelectItem value="last_3">Ostatnie 3 miesiące</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={exportCSV} className="gap-2">
              <Download className="h-4 w-4" /> Eksport CSV
            </Button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Kontakty łącznie", value: totals.contacts, icon: Users, color: "text-primary" },
            { label: "Zamknięte transakcje", value: totals.deals, icon: CheckCircle2, color: "text-success" },
            { label: "Wartość transakcji", value: fmt(totals.dealValue), icon: TrendingUp, color: "text-gold" },
            { label: "Nieopłacone prowizje", value: fmt(totals.unpaid), icon: Euro, color: "text-destructive" },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="rounded-lg bg-muted p-2">
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className={`text-xl font-bold ${color}`}>{loading ? "—" : value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Partner table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Zestawienie per partner</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Ładowanie...</div>
            ) : reports.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Brak danych</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Partner</TableHead>
                      <TableHead className="text-right">Kontakty</TableHead>
                      <TableHead className="text-right">Transakcje</TableHead>
                      <TableHead className="text-right">Wartość transakcji</TableHead>
                      <TableHead className="text-right">Prowizja</TableHead>
                      <TableHead className="text-right">Nieopłacona</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reports.map((r) => (
                      <TableRow key={r.partner_id}>
                        <TableCell className="font-medium">{r.partner_name}</TableCell>
                        <TableCell className="text-right">{r.total_contacts}</TableCell>
                        <TableCell className="text-right">
                          <span className={r.closed_deals > 0 ? "text-success font-semibold" : "text-muted-foreground"}>
                            {r.closed_deals}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-medium">{fmt(r.total_deal_value)}</TableCell>
                        <TableCell className="text-right">{fmt(r.total_commission)}</TableCell>
                        <TableCell className="text-right">
                          <span className={r.unpaid_commission > 0 ? "text-destructive font-semibold" : "text-muted-foreground"}>
                            {fmt(r.unpaid_commission)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Totals row */}
                    <TableRow className="border-t-2 border-border font-semibold bg-muted/30">
                      <TableCell className="font-bold">ŁĄCZNIE</TableCell>
                      <TableCell className="text-right font-bold">{totals.contacts}</TableCell>
                      <TableCell className="text-right font-bold text-success">{totals.deals}</TableCell>
                      <TableCell className="text-right font-bold">{fmt(totals.dealValue)}</TableCell>
                      <TableCell className="text-right font-bold">{fmt(totals.commission)}</TableCell>
                      <TableCell className="text-right font-bold text-destructive">{fmt(totals.unpaid)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
