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
  Cell,
} from "recharts";
import { Download, TrendingUp, Euro, Users, CheckCircle2, Loader2, Home } from "lucide-react";
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

const PARTNER_COLORS = [
  "#1E4FA0",
  "#F5A623",
  "#27AE60",
  "#E74C3C",
  "#8E44AD",
  "#16A085",
  "#D35400",
  "#2980B9",
  "#C0392B",
  "#1ABC9C",
];

const getColor = (i: number) => PARTNER_COLORS[i % PARTNER_COLORS.length];

// Custom bar shape with per-entry color
const ColoredBar = (props: any) => {
  const { x, y, width, height, fill } = props;
  return <rect x={x} y={y} width={width} height={height} fill={fill} rx={4} ry={4} />;
};

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
          return { partner_id: partner.id, partner_name: partner.name, total_contacts: 0, closed_deals: 0, total_deal_value: 0, total_commission: 0, unpaid_commission: 0, paid_commission: 0, transaction_ids: [] };
        }

        let contactsQuery = supabase.from("contacts").select("id", { count: "exact" }).in("affiliate_link_id", linkIds);
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

        return { partner_id: partner.id, partner_name: partner.name, total_contacts: totalContacts ?? 0, closed_deals: closedDeals, total_deal_value: totalDealValue, total_commission: totalCommission, unpaid_commission: unpaidCommission, paid_commission: paidCommission, transaction_ids: transactionIds };
      })
    );

    setReports(reportData);
    setLoading(false);
  };

  useEffect(() => { fetchReports(); }, [period]);

  const totals = reports.reduce(
    (acc, r) => ({ contacts: acc.contacts + r.total_contacts, deals: acc.deals + r.closed_deals, dealValue: acc.dealValue + r.total_deal_value, commission: acc.commission + r.total_commission, unpaid: acc.unpaid + r.unpaid_commission, paid: acc.paid + r.paid_commission }),
    { contacts: 0, deals: 0, dealValue: 0, commission: 0, unpaid: 0, paid: 0 }
  );

  const handleToggleAllPaid = async (partnerId: string, markAsPaid: boolean) => {
    const partner = reports.find((r) => r.partner_id === partnerId);
    if (!partner || partner.transaction_ids.length === 0) return;
    setTogglingPaid(partnerId);
    const { error } = await supabase.from("transactions").update({ commission_paid: markAsPaid }).in("id", partner.transaction_ids);
    if (error) {
      toast({ title: "Błąd", description: "Nie udało się zaktualizować prowizji.", variant: "destructive" });
    } else {
      toast({ title: markAsPaid ? "Prowizje opłacone" : "Prowizje cofnięte", description: `Zaktualizowano prowizje dla ${partner.partner_name}.` });
      await fetchReports();
    }
    setTogglingPaid(null);
  };

  const fmt = (n: number) => new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(n);

  const periodLabel = () => {
    switch (period) {
      case "this_month": return "Ten miesiąc";
      case "last_month": return "Poprzedni miesiąc";
      case "last_3": return "Ostatnie 3 miesiące";
      default: return "Cały czas";
    }
  };

  // Helper: hex color string to RGB array for jsPDF
  const hexToRgb = (hex: string): [number, number, number] => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b];
  };

  const exportPDF = async () => {
    setExportLoading(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");

      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth(); // 297
      const margin = 14;
      const contentW = pageW - margin * 2;

      // ── Header bar ──────────────────────────────────────────────
      doc.setFillColor(24, 54, 97);
      doc.rect(0, 0, pageW, 22, "F");
      // gold accent line
      doc.setFillColor(245, 166, 35);
      doc.rect(0, 22, pageW, 1.5, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(17);
      doc.setFont("helvetica", "bold");
      doc.text("Brand & Sell — Raport afiliacyjny", margin, 14);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(200, 215, 240);
      doc.text(
        `Okres: ${periodLabel()}   |   Wygenerowano: ${format(new Date(), "dd.MM.yyyy HH:mm")}`,
        pageW - margin, 14, { align: "right" }
      );

      // ── Summary boxes (6 boxes) ──────────────────────────────────
      const boxes = [
        { label: "Kontakty łącznie", value: String(totals.contacts), accent: [24, 54, 97] as [number,number,number] },
        { label: "Sprzedane", value: String(totals.deals), accent: [39, 174, 96] as [number,number,number] },
        { label: "Wartość transakcji", value: fmt(totals.dealValue), accent: [245, 166, 35] as [number,number,number] },
        { label: "Prowizja łącznie", value: fmt(totals.commission), accent: [24, 54, 97] as [number,number,number] },
        { label: "Prowizja opłacona", value: fmt(totals.paid), accent: [39, 174, 96] as [number,number,number] },
        { label: "Nieopłacona", value: fmt(totals.unpaid), accent: [200, 50, 50] as [number,number,number] },
      ];
      const boxY = 27;
      const boxH = 18;
      const boxGap = 2;
      const boxW = (contentW - boxGap * (boxes.length - 1)) / boxes.length;
      boxes.forEach((box, i) => {
        const x = margin + i * (boxW + boxGap);
        // card bg
        doc.setFillColor(245, 248, 255);
        doc.roundedRect(x, boxY, boxW, boxH, 2, 2, "F");
        // top accent stripe
        doc.setFillColor(...box.accent);
        doc.roundedRect(x, boxY, boxW, 2.5, 1, 1, "F");
        // label
        doc.setFontSize(6.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 110, 130);
        doc.text(box.label, x + boxW / 2, boxY + 8, { align: "center" });
        // value
        doc.setFontSize(9.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...box.accent);
        doc.text(box.value, x + boxW / 2, boxY + 14.5, { align: "center" });
      });

      // ── Vector bar charts ────────────────────────────────────────
      const chartTopY = boxY + boxH + 6;
      const chartH = 52;
      const chartW = (contentW - 6) / 2;
      const barMaxVal1 = Math.max(...activePartners.map(r => r.total_contacts), 1);
      const barMaxVal2 = Math.max(...activePartners.map(r => r.closed_deals), 1);

      const drawBarChart = (
        data: { name: string; value: number; colorHex: string }[],
        startX: number,
        title: string,
        maxVal: number
      ) => {
        const plotX = startX + 10;
        const plotW = chartW - 14;
        const plotY = chartTopY + 8;
        const plotH = chartH - 12;

        // title
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(24, 54, 97);
        doc.text(title, startX + chartW / 2, chartTopY + 4, { align: "center" });

        // background & grid
        doc.setFillColor(250, 251, 255);
        doc.roundedRect(startX, chartTopY + 6, chartW, chartH - 4, 2, 2, "F");
        doc.setDrawColor(220, 225, 235);
        doc.setLineWidth(0.2);
        for (let g = 0; g <= 4; g++) {
          const gy = plotY + plotH - (g / 4) * plotH;
          doc.line(plotX, gy, plotX + plotW, gy);
          doc.setFontSize(5.5);
          doc.setTextColor(150, 155, 165);
          doc.setFont("helvetica", "normal");
          doc.text(String(Math.round((g / 4) * maxVal)), plotX - 1, gy + 0.8, { align: "right" });
        }

        if (data.length === 0) return;

        const barWidth = Math.min((plotW / data.length) * 0.55, 16);
        const barSpacing = plotW / data.length;

        data.forEach((d, idx) => {
          const bx = plotX + idx * barSpacing + barSpacing / 2 - barWidth / 2;
          const bh = (d.value / maxVal) * plotH;
          const by = plotY + plotH - bh;
          const [r2, g2, b2] = hexToRgb(d.colorHex);
          doc.setFillColor(r2, g2, b2);
          if (bh > 0) {
            doc.roundedRect(bx, by, barWidth, bh, 1, 1, "F");
          }
          // value label on top
          if (d.value > 0) {
            doc.setFontSize(6);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(r2, g2, b2);
            doc.text(String(d.value), bx + barWidth / 2, by - 1, { align: "center" });
          }
          // x-axis label
          doc.setFontSize(5.5);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(80, 90, 110);
          const nameShort = d.name.length > 10 ? d.name.slice(0, 10) + "." : d.name;
          doc.text(nameShort, bx + barWidth / 2, plotY + plotH + 5, { align: "center", maxWidth: barSpacing - 1 });
        });
      };

      drawBarChart(
        activePartners.map((r, i) => ({ name: r.partner_name, value: r.total_contacts, colorHex: getColor(reports.findIndex(x => x.partner_id === r.partner_id)) })),
        margin, "Kontakty przez linki", barMaxVal1
      );
      drawBarChart(
        activePartners.map((r, i) => ({ name: r.partner_name, value: r.closed_deals, colorHex: getColor(reports.findIndex(x => x.partner_id === r.partner_id)) })),
        margin + chartW + 6, "Sprzedane nieruchomości", barMaxVal2
      );

      // ── Legend (color dots + partner names) ─────────────────────
      const legendY = chartTopY + chartH + 6;
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "normal");
      let lx = margin;
      activePartners.forEach((r, i) => {
        const colorHex = getColor(reports.findIndex(x => x.partner_id === r.partner_id));
        const [rr, gg, bb] = hexToRgb(colorHex);
        doc.setFillColor(rr, gg, bb);
        doc.circle(lx + 2, legendY + 1.2, 1.8, "F");
        doc.setTextColor(50, 60, 80);
        const label = r.partner_name.length > 18 ? r.partner_name.slice(0, 18) + "." : r.partner_name;
        doc.text(label, lx + 5.5, legendY + 2);
        lx += doc.getTextWidth(label) + 11;
        if (lx > pageW - margin - 30) { lx = margin; }
      });

      // ── Data table ───────────────────────────────────────────────
      const tableStartY = legendY + 8;

      autoTable(doc, {
        startY: tableStartY,
        margin: { left: margin, right: margin },
        head: [["Partner", "Kontakty", "Sprzedane", "Wartość transakcji", "Prowizja", "Opłacona", "Nieopłacona", "Status prowizji"]],
        body: [
          ...reports.map((r) => [
            r.partner_name,
            r.total_contacts,
            r.closed_deals,
            fmt(r.total_deal_value),
            fmt(r.total_commission),
            fmt(r.paid_commission),
            fmt(r.unpaid_commission),
            r.unpaid_commission === 0 && r.total_commission > 0
              ? "Oplacona"
              : r.unpaid_commission > 0
              ? "Nieoplacona"
              : "Brak transakcji",
          ]),
          ["LACZNIE", totals.contacts, totals.deals, fmt(totals.dealValue), fmt(totals.commission), fmt(totals.paid), fmt(totals.unpaid), ""],
        ],
        headStyles: {
          fillColor: [24, 54, 97],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 8,
          cellPadding: 3,
        },
        bodyStyles: { fontSize: 8, cellPadding: 2.5, textColor: [40, 50, 70] },
        alternateRowStyles: { fillColor: [245, 248, 255] },
        columnStyles: {
          0: { fontStyle: "bold" },
          1: { halign: "center" },
          2: { halign: "center" },
          3: { halign: "right" },
          4: { halign: "right" },
          5: { halign: "right" },
          6: { halign: "right" },
          7: { halign: "center" },
        },
        didParseCell: (data) => {
          // totals row
          if (data.row.index === reports.length) {
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.fillColor = [215, 225, 245];
            data.cell.styles.textColor = [24, 54, 97];
          }
          // status column coloring
          if (data.column.index === 7 && data.section === "body") {
            const val = String(data.cell.raw);
            if (val === "Oplacona") {
              data.cell.styles.textColor = [39, 174, 96];
              data.cell.styles.fontStyle = "bold";
            } else if (val === "Nieoplacona") {
              data.cell.styles.textColor = [200, 50, 50];
              data.cell.styles.fontStyle = "bold";
            }
          }
          // partner color dot via left border trick
          if (data.column.index === 0 && data.section === "body" && data.row.index < reports.length) {
            const colorHex = getColor(data.row.index);
            const [rr, gg, bb] = hexToRgb(colorHex);
            data.cell.styles.lineColor = [rr, gg, bb];
            (data.cell.styles as any).lineWidths = { left: 2.5, top: 0, right: 0, bottom: 0 };
          }
        },
      });

      // ── Footer ───────────────────────────────────────────────────
      const pageH = doc.internal.pageSize.getHeight();
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(160, 165, 180);
      doc.text("Brand & Sell — System Linków Afiliacyjnych", margin, pageH - 5);
      doc.text(`Strona 1 | ${format(new Date(), "dd.MM.yyyy")}`, pageW - margin, pageH - 5, { align: "right" });

      doc.save(`raport-afiliacyjny-${format(new Date(), "yyyy-MM-dd")}.pdf`);
      toast({ title: "PDF wygenerowany", description: "Raport został pobrany." });
    } catch (e) {
      console.error(e);
      toast({ title: "Błąd eksportu", description: "Nie udało się wygenerować PDF.", variant: "destructive" });
    }
    setExportLoading(false);
  };

  // Chart data — only partners with any activity
  const activePartners = reports.map((r, i) => ({ ...r, color: getColor(i) })).filter((r) => r.total_contacts > 0 || r.closed_deals > 0);

  // Pie data for commissions
  const pieData = [
    { name: "Opłacone", value: totals.paid },
    { name: "Nieopłacone", value: totals.unpaid },
  ].filter((d) => d.value > 0);

  const PIE_COLORS = ["#27AE60", "#E74C3C"];

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-background border border-border rounded-xl shadow-xl px-3 py-2 text-xs min-w-[130px]">
        <p className="font-semibold text-foreground mb-1">{label}</p>
        {payload.map((p: any) => (
          <div key={p.name} className="flex items-center gap-2 py-0.5">
            <span className="h-2 w-2 rounded-full shrink-0" style={{ background: p.color || p.fill }} />
            <span className="text-muted-foreground">{p.name}:</span>
            <span className="font-medium text-foreground ml-auto pl-2">{typeof p.value === "number" && p.value > 100 ? fmt(p.value) : p.value}</span>
          </div>
        ))}
      </div>
    );
  };

  const CustomPieTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-background border border-border rounded-xl shadow-xl px-3 py-2 text-xs">
        <p className="font-semibold text-foreground">{payload[0].name}</p>
        <p className="text-muted-foreground">{fmt(payload[0].value)}</p>
      </div>
    );
  };

  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if (percent < 0.05) return null;
    const RADIAN = Math.PI / 180;
    const r = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + r * Math.cos(-midAngle * RADIAN);
    const y = cy + r * Math.sin(-midAngle * RADIAN);
    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={13} fontWeight={700}>
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <AppShell>
      <div className="p-6 space-y-6" ref={reportRef}>
        {/* Header */}
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
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {[
            { label: "Kontakty łącznie", value: loading ? "—" : totals.contacts, icon: Users, color: "text-primary", bg: "bg-primary/10" },
            { label: "Sprzedane", value: loading ? "—" : totals.deals, icon: Home, color: "text-success", bg: "bg-success/10" },
            { label: "Wartość transakcji", value: loading ? "—" : fmt(totals.dealValue), icon: TrendingUp, color: "text-gold", bg: "bg-gold/10" },
            { label: "Prowizja łącznie", value: loading ? "—" : fmt(totals.commission), icon: Euro, color: "text-primary", bg: "bg-primary/10" },
            { label: "Prowizja opłacona", value: loading ? "—" : fmt(totals.paid), icon: CheckCircle2, color: "text-success", bg: "bg-success/10" },
            { label: "Nieopłacone", value: loading ? "—" : fmt(totals.unpaid), icon: Euro, color: "text-destructive", bg: "bg-destructive/10" },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <Card key={label} className="border-border/60">
              <CardContent className="p-4">
                <div className={`inline-flex rounded-lg p-2 mb-2 ${bg}`}>
                  <Icon className={`h-4 w-4 ${color}`} />
                </div>
                <p className="text-xs text-muted-foreground leading-tight">{label}</p>
                <p className={`text-lg font-bold mt-0.5 ${color}`}>{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts */}
        {!loading && activePartners.length > 0 && (
          <div data-charts className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Chart 1 — Contacts per partner */}
            <Card className="border-border/60">
              <CardHeader className="pb-1 pt-4 px-5">
                <CardTitle className="text-sm font-semibold text-foreground">Kontakty przez linki</CardTitle>
                <p className="text-xs text-muted-foreground">Liczba kontaktów per partner</p>
              </CardHeader>
              <CardContent className="px-2 pb-4 pt-1">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={activePartners} margin={{ top: 8, right: 12, left: -10, bottom: 48 }} barSize={28}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="partner_name"
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      angle={-35}
                      textAnchor="end"
                      interval={0}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted))", radius: 4 }} />
                    <Bar dataKey="total_contacts" name="Kontakty" radius={[5, 5, 0, 0]}>
                      {activePartners.map((entry, i) => (
                        <Cell key={entry.partner_id} fill={getColor(reports.findIndex(r => r.partner_id === entry.partner_id))} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                {/* Legend */}
                <div className="flex flex-wrap gap-x-3 gap-y-1 px-2 mt-1">
                  {activePartners.map((r) => (
                    <div key={r.partner_id} className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: r.color }} />
                      <span className="text-[11px] text-muted-foreground truncate max-w-[90px]">{r.partner_name}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Chart 2 — Sold properties per partner */}
            <Card className="border-border/60">
              <CardHeader className="pb-1 pt-4 px-5">
                <CardTitle className="text-sm font-semibold text-foreground">Sprzedane nieruchomości</CardTitle>
                <p className="text-xs text-muted-foreground">Zamknięte transakcje per partner</p>
              </CardHeader>
              <CardContent className="px-2 pb-4 pt-1">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={activePartners} margin={{ top: 8, right: 12, left: -10, bottom: 48 }} barSize={28}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="partner_name"
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      angle={-35}
                      textAnchor="end"
                      interval={0}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted))", radius: 4 }} />
                    <Bar dataKey="closed_deals" name="Sprzedane" radius={[5, 5, 0, 0]}>
                      {activePartners.map((entry) => (
                        <Cell key={entry.partner_id} fill={getColor(reports.findIndex(r => r.partner_id === entry.partner_id))} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-x-3 gap-y-1 px-2 mt-1">
                  {activePartners.map((r) => (
                    <div key={r.partner_id} className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: r.color }} />
                      <span className="text-[11px] text-muted-foreground truncate max-w-[90px]">{r.partner_name}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

          
          </div>
        )}

        {/* Partner table */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Zestawienie per partner</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Ładowanie...
              </div>
            ) : reports.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Brak danych</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="w-4 pl-4" />
                      <TableHead>Partner</TableHead>
                      <TableHead className="text-right">Kontakty</TableHead>
                      <TableHead className="text-right">Sprzedane</TableHead>
                      <TableHead className="text-right">Wartość transakcji</TableHead>
                      <TableHead className="text-right">Prowizja</TableHead>
                      <TableHead className="text-right">Opłacona</TableHead>
                      <TableHead className="text-right">Nieopłacona</TableHead>
                      <TableHead className="text-center">Akcja</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reports.map((r, i) => (
                      <TableRow key={r.partner_id} className="hover:bg-muted/20">
                        <TableCell className="pl-4">
                          <span className="block h-3 w-3 rounded-full" style={{ background: getColor(i) }} />
                        </TableCell>
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
                                className="text-xs h-7 border-success text-success hover:bg-success hover:text-white gap-1"
                                disabled={togglingPaid === r.partner_id}
                                onClick={() => handleToggleAllPaid(r.partner_id, true)}
                              >
                                {togglingPaid === r.partner_id
                                  ? <Loader2 className="h-3 w-3 animate-spin" />
                                  : <CheckCircle2 className="h-3 w-3" />}
                                Oznacz opłacone
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
                    <TableRow className="border-t-2 border-border bg-muted/30">
                      <TableCell />
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
