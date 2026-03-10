import { useEffect, useRef, useState } from "react";
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
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Download, TrendingUp, Euro, Users, CheckCircle2, Loader2 } from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface PartnerReport {
  partner_id: string;
  partner_name: string;
  total_contacts: number;
  closed_deals: number;
  total_deal_value: number;
  total_commission: number;
  unpaid_commission: number;
  paid_commission: number;
  transaction_ids: string[];
}

const CHART_COLORS = [
  "hsl(215,60%,40%)",
  "hsl(38,85%,52%)",
  "hsl(142,71%,45%)",
  "hsl(0,72%,51%)",
  "hsl(270,60%,55%)",
  "hsl(190,80%,40%)",
  "hsl(30,90%,55%)",
  "hsl(160,60%,40%)",
  "hsl(340,70%,50%)",
  "hsl(55,90%,45%)",
];

export default function Reports() {
  const [reports, setReports] = useState<PartnerReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);
  const [period, setPeriod] = useState("all");
  const [togglingPaid, setTogglingPaid] = useState<string | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

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

    const { data: partners } = await supabase.from("partners").select("id, name").eq("is_active", true);
    if (!partners) { setLoading(false); return; }

    const reportData: PartnerReport[] = await Promise.all(
      partners.map(async (partner) => {
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
            paid_commission: 0,
            transaction_ids: [],
          };
        }

        let contactsQuery = supabase.from("contacts").select("id, status", { count: "exact" }).in("affiliate_link_id", linkIds);
        if (dates) contactsQuery = contactsQuery.gte("created_at", dates.from).lte("created_at", dates.to);
        const { count: totalContacts } = await contactsQuery;

        let txQuery = supabase.from("transactions").select("id, deal_value, commission_amount, commission_paid").in("affiliate_link_id", linkIds);
        if (dates) txQuery = txQuery.gte("created_at", dates.from).lte("created_at", dates.to);
        const { data: txData } = await txQuery;

        const closedDeals = txData?.length ?? 0;
        const totalDealValue = txData?.reduce((s, t) => s + (t.deal_value ?? 0), 0) ?? 0;
        const totalCommission = txData?.reduce((s, t) => s + (t.commission_amount ?? 0), 0) ?? 0;
        const unpaidCommission = txData?.filter((t) => !t.commission_paid).reduce((s, t) => s + (t.commission_amount ?? 0), 0) ?? 0;
        const paidCommission = txData?.filter((t) => t.commission_paid).reduce((s, t) => s + (t.commission_amount ?? 0), 0) ?? 0;
        const transactionIds = txData?.map((t) => t.id) ?? [];

        return {
          partner_id: partner.id,
          partner_name: partner.name,
          total_contacts: totalContacts ?? 0,
          closed_deals: closedDeals,
          total_deal_value: totalDealValue,
          total_commission: totalCommission,
          unpaid_commission: unpaidCommission,
          paid_commission: paidCommission,
          transaction_ids: transactionIds,
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
      paid: acc.paid + r.paid_commission,
    }),
    { contacts: 0, deals: 0, dealValue: 0, commission: 0, unpaid: 0, paid: 0 }
  );

  const handleToggleAllPaid = async (partnerId: string, markAsPaid: boolean) => {
    const partner = reports.find((r) => r.partner_id === partnerId);
    if (!partner || partner.transaction_ids.length === 0) return;

    setTogglingPaid(partnerId);
    const { error } = await supabase
      .from("transactions")
      .update({ commission_paid: markAsPaid })
      .in("id", partner.transaction_ids);

    if (error) {
      toast({ title: "Błąd", description: "Nie udało się zaktualizować prowizji.", variant: "destructive" });
    } else {
      toast({ title: markAsPaid ? "Prowizje opłacone" : "Prowizje cofnięte", description: `Zaktualizowano prowizje dla ${partner.partner_name}.` });
      await fetchReports();
    }
    setTogglingPaid(null);
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(n);

  const periodLabel = () => {
    switch (period) {
      case "this_month": return "Ten miesiąc";
      case "last_month": return "Poprzedni miesiąc";
      case "last_3": return "Ostatnie 3 miesiące";
      default: return "Cały czas";
    }
  };

  const exportPDF = async () => {
    if (!reportRef.current) return;
    setExportLoading(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      const html2canvas = (await import("html2canvas")).default;

      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();

      // Header
      doc.setFillColor(24, 54, 97);
      doc.rect(0, 0, pageW, 20, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Raport afiliacyjny — Brand & Sell", 14, 13);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Okres: ${periodLabel()} | Wygenerowano: ${format(new Date(), "dd.MM.yyyy HH:mm")}`, pageW - 14, 13, { align: "right" });

      // Summary boxes
      doc.setTextColor(30, 30, 30);
      const boxes = [
        { label: "Kontakty łącznie", value: String(totals.contacts) },
        { label: "Transakcje", value: String(totals.deals) },
        { label: "Wartość transakcji", value: fmt(totals.dealValue) },
        { label: "Prowizja łącznie", value: fmt(totals.commission) },
        { label: "Nieopłacone", value: fmt(totals.unpaid) },
        { label: "Opłacone", value: fmt(totals.paid) },
      ];
      const boxW = (pageW - 28) / boxes.length;
      boxes.forEach((box, i) => {
        const x = 14 + i * boxW;
        doc.setFillColor(240, 245, 255);
        doc.roundedRect(x, 24, boxW - 2, 16, 2, 2, "F");
        doc.setFontSize(7);
        doc.setTextColor(100, 100, 120);
        doc.text(box.label, x + (boxW - 2) / 2, 30, { align: "center" });
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(24, 54, 97);
        doc.text(box.value, x + (boxW - 2) / 2, 36, { align: "center" });
        doc.setFont("helvetica", "normal");
      });

      // Capture charts
      const chartsEl = reportRef.current.querySelector("[data-charts]") as HTMLElement;
      if (chartsEl) {
        const canvas = await html2canvas(chartsEl, { scale: 2, backgroundColor: "#ffffff" });
        const imgData = canvas.toDataURL("image/png");
        const chartH = (canvas.height / canvas.width) * (pageW - 28);
        doc.addImage(imgData, "PNG", 14, 44, pageW - 28, Math.min(chartH, 70));
      }

      // Table
      const tableY = 120;
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 30, 30);
      doc.text("Zestawienie per partner", 14, tableY - 3);

      autoTable(doc, {
        startY: tableY,
        head: [["Partner", "Kontakty", "Transakcje", "Wartość transakcji", "Prowizja łącznie", "Prowizja opłacona", "Nieopłacona", "Status"]],
        body: [
          ...reports.map((r) => [
            r.partner_name,
            r.total_contacts,
            r.closed_deals,
            fmt(r.total_deal_value),
            fmt(r.total_commission),
            fmt(r.paid_commission),
            fmt(r.unpaid_commission),
            r.unpaid_commission === 0 && r.total_commission > 0 ? "✓ Opłacona" : r.unpaid_commission > 0 ? "⚠ Nieopłacona" : "—",
          ]),
          ["ŁĄCZNIE", totals.contacts, totals.deals, fmt(totals.dealValue), fmt(totals.commission), fmt(totals.paid), fmt(totals.unpaid), ""],
        ],
        headStyles: { fillColor: [24, 54, 97], textColor: 255, fontStyle: "bold", fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        alternateRowStyles: { fillColor: [245, 248, 255] },
        footStyles: { fillColor: [200, 215, 240], textColor: [20, 40, 80], fontStyle: "bold" },
        didParseCell: (data) => {
          if (data.row.index === reports.length) {
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.fillColor = [200, 215, 240];
          }
          if (data.column.index === 7) {
            const val = String(data.cell.raw);
            if (val.includes("✓")) data.cell.styles.textColor = [34, 139, 34];
            else if (val.includes("⚠")) data.cell.styles.textColor = [180, 30, 30];
          }
        },
      });

      doc.save(`raport-afiliacyjny-${format(new Date(), "yyyy-MM-dd")}.pdf`);
      toast({ title: "PDF wygenerowany", description: "Raport został pobrany." });
    } catch (e) {
      console.error(e);
      toast({ title: "Błąd eksportu", description: "Nie udało się wygenerować PDF.", variant: "destructive" });
    }
    setExportLoading(false);
  };

  const barData = reports.filter((r) => r.closed_deals > 0 || r.total_contacts > 0);
  const pieData = [
    { name: "Opłacone", value: totals.paid },
    { name: "Nieopłacone", value: totals.unpaid },
  ].filter((d) => d.value > 0);

  return (
    <AppShell>
      <div className="p-6 space-y-6" ref={reportRef}>
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
            <Button variant="outline" onClick={exportPDF} disabled={exportLoading} className="gap-2">
              {exportLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Eksport PDF
            </Button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: "Kontakty łącznie", value: totals.contacts, icon: Users, color: "text-primary" },
            { label: "Transakcje", value: totals.deals, icon: CheckCircle2, color: "text-success" },
            { label: "Wartość transakcji", value: fmt(totals.dealValue), icon: TrendingUp, color: "text-gold" },
            { label: "Prowizja łącznie", value: fmt(totals.commission), icon: Euro, color: "text-primary" },
            { label: "Prowizja opłacona", value: fmt(totals.paid), icon: CheckCircle2, color: "text-success" },
            { label: "Nieopłacone", value: fmt(totals.unpaid), icon: Euro, color: "text-destructive" },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="rounded-lg bg-muted p-2">
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground leading-tight">{label}</p>
                  <p className={`text-lg font-bold ${color}`}>{loading ? "—" : value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts */}
        {!loading && reports.length > 0 && (
          <div data-charts className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Bar chart — contacts & deals per partner */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Kontakty i transakcje per partner</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={barData} margin={{ top: 4, right: 8, left: 0, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="partner_name"
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      angle={-30}
                      textAnchor="end"
                      interval={0}
                    />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ fontWeight: 600 }}
                    />
                    <Bar dataKey="total_contacts" name="Kontakty" fill="hsl(215,60%,40%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="closed_deals" name="Transakcje" fill="hsl(142,71%,45%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Pie chart — paid vs unpaid commissions */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Status prowizji</CardTitle>
              </CardHeader>
              <CardContent>
                {pieData.length === 0 ? (
                  <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">Brak danych prowizji</div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="45%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        <Cell fill="hsl(142,71%,45%)" />
                        <Cell fill="hsl(0,72%,51%)" />
                      </Pie>
                      <Legend formatter={(v) => <span style={{ fontSize: 12 }}>{v}</span>} />
                      <Tooltip
                        formatter={(val: number) => fmt(val)}
                        contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Bar chart — commission value per partner */}
            <Card className="md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Prowizje per partner (PLN)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={barData} margin={{ top: 4, right: 8, left: 0, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="partner_name"
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      angle={-30}
                      textAnchor="end"
                      interval={0}
                    />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${v.toLocaleString("pl-PL")} zł`} />
                    <Tooltip
                      formatter={(val: number) => fmt(val)}
                      contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ fontWeight: 600 }}
                    />
                    <Bar dataKey="paid_commission" name="Opłacona" stackId="a" fill="hsl(142,71%,45%)" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="unpaid_commission" name="Nieopłacona" stackId="a" fill="hsl(0,72%,51%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )}

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
                      <TableHead className="text-right">Opłacona</TableHead>
                      <TableHead className="text-right">Nieopłacona</TableHead>
                      <TableHead className="text-center">Akcja</TableHead>
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
                          <span className="text-success font-semibold">{fmt(r.paid_commission)}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={r.unpaid_commission > 0 ? "text-destructive font-semibold" : "text-muted-foreground"}>
                            {fmt(r.unpaid_commission)}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          {r.transaction_ids.length > 0 ? (
                            r.unpaid_commission > 0 ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs h-7 border-success text-success hover:bg-success hover:text-success-foreground"
                                disabled={togglingPaid === r.partner_id}
                                onClick={() => handleToggleAllPaid(r.partner_id, true)}
                              >
                                {togglingPaid === r.partner_id ? <Loader2 className="h-3 w-3 animate-spin" /> : "✓ Oznacz jako opłacone"}
                              </Button>
                            ) : r.paid_commission > 0 ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-xs h-7 text-muted-foreground hover:text-destructive"
                                disabled={togglingPaid === r.partner_id}
                                onClick={() => handleToggleAllPaid(r.partner_id, false)}
                              >
                                {togglingPaid === r.partner_id ? <Loader2 className="h-3 w-3 animate-spin" /> : "↩ Cofnij"}
                              </Button>
                            ) : null
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
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
                      <TableCell className="text-right font-bold text-success">{fmt(totals.paid)}</TableCell>
                      <TableCell className="text-right font-bold text-destructive">{fmt(totals.unpaid)}</TableCell>
                      <TableCell />
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
