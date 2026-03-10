import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { UserCheck, TrendingUp, Filter, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";

interface Contact {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  message: string | null;
  status: "new" | "in_progress" | "deal_closed" | "no_deal";
  notes: string | null;
  created_at: string;
  affiliate_link_id: string | null;
  affiliate_links: {
    tracking_code: string;
    property_name: string | null;
    link_type: string;
    partners: { name: string } | null;
  } | null;
}

const statusConfig = {
  new: { label: "Nowy", className: "bg-blue-50 text-blue-700 border-blue-200" },
  in_progress: { label: "W trakcie", className: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  deal_closed: { label: "Transakcja zawarta", className: "bg-green-50 text-green-700 border-green-200" },
  no_deal: { label: "Brak transakcji", className: "bg-red-50 text-red-700 border-red-200" },
};

export default function Contacts() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Contact | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [dealOpen, setDealOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [partnerFilter, setPartnerFilter] = useState("all");
  const [partners, setPartners] = useState<{ id: string; name: string }[]>([]);
  const [dealForm, setDealForm] = useState({ deal_value: "", commission_amount: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const fetchContacts = async () => {
    const { data } = await supabase
      .from("contacts")
      .select(`
        *,
        affiliate_links (
          tracking_code, property_name, link_type,
          partners ( name )
        )
      `)
      .order("created_at", { ascending: false });
    if (data) setContacts(data as any);
    setLoading(false);
  };

  const fetchPartners = async () => {
    const { data } = await supabase.from("partners").select("id, name").order("name");
    if (data) setPartners(data);
  };

  useEffect(() => {
    fetchContacts();
    fetchPartners();
  }, []);

  const updateStatus = async (contactId: string, status: "new" | "in_progress" | "deal_closed" | "no_deal") => {
    await supabase.from("contacts").update({ status }).eq("id", contactId);
    toast({ title: "Status zaktualizowany" });
    fetchContacts();
    if (selected?.id === contactId) {
      setSelected((prev) => prev ? { ...prev, status: status as any } : null);
    }
  };

  const openDetail = (c: Contact) => {
    setSelected(c);
    setDetailOpen(true);
  };

  const openDealDialog = (c: Contact) => {
    setSelected(c);
    setDealForm({ deal_value: "", commission_amount: "", notes: "" });
    setDealOpen(true);
    setDetailOpen(false);
  };

  const handleCloseDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);

    // Mark contact as deal_closed
    await supabase.from("contacts").update({ status: "deal_closed" }).eq("id", selected.id);

    // Create transaction
    const { error } = await supabase.from("transactions").insert({
      contact_id: selected.id,
      affiliate_link_id: selected.affiliate_link_id,
      partner_id: selected.affiliate_links?.partners ? undefined : undefined,
      property_name: selected.affiliate_links?.property_name,
      deal_value: dealForm.deal_value ? parseFloat(dealForm.deal_value) : null,
      commission_amount: dealForm.commission_amount ? parseFloat(dealForm.commission_amount) : null,
      notes: dealForm.notes || null,
      closed_by: user?.id,
    });

    if (error) {
      toast({ title: "Błąd", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Transakcja oznaczona jako zawarta!" });
    }

    setSaving(false);
    setDealOpen(false);
    fetchContacts();
  };

  const filtered = contacts.filter((c) => {
    const statusOk = statusFilter === "all" || c.status === statusFilter;
    const partnerOk = partnerFilter === "all" || c.affiliate_links?.partners?.name === partners.find(p => p.id === partnerFilter)?.name;
    return statusOk && partnerOk;
  });

  return (
    <AppShell>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Kontakty / Leady</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Wszystkie kontakty z linków afiliacyjnych</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Filtruj:</span>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszystkie statusy</SelectItem>
              <SelectItem value="new">Nowy</SelectItem>
              <SelectItem value="in_progress">W trakcie</SelectItem>
              <SelectItem value="deal_closed">Transakcja zawarta</SelectItem>
              <SelectItem value="no_deal">Brak transakcji</SelectItem>
            </SelectContent>
          </Select>
          <Select value={partnerFilter} onValueChange={setPartnerFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Wszyscy partnerzy" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszyscy partnerzy</SelectItem>
              {partners.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">{filtered.length} kontaktów</span>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Ładowanie...</div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center">
                <UserCheck className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground">Brak kontaktów</p>
                <p className="text-xs text-muted-foreground mt-1">Kontakty pojawią się gdy ktoś wejdzie przez link afiliacyjny</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Klient</TableHead>
                      <TableHead>Kontakt</TableHead>
                      <TableHead>Partner</TableHead>
                      <TableHead>Nieruchomość</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Akcje</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((c) => {
                      const s = statusConfig[c.status];
                      return (
                        <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openDetail(c)}>
                          <TableCell className="font-medium">{c.full_name}</TableCell>
                          <TableCell>
                            <div className="text-sm space-y-0.5">
                              {c.email && <div className="text-muted-foreground">{c.email}</div>}
                              {c.phone && <div className="text-muted-foreground">{c.phone}</div>}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{c.affiliate_links?.partners?.name ?? "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{c.affiliate_links?.property_name ?? "—"}</TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${s.className}`}>
                              {s.label}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(c.created_at), "d MMM yyyy", { locale: pl })}
                          </TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              {c.status !== "deal_closed" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-xs gap-1 text-green-700 border-green-200 hover:bg-green-50"
                                  onClick={() => openDealDialog(c)}
                                >
                                  <TrendingUp className="h-3 w-3" /> Transakcja
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contact detail dialog */}
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="max-w-lg">
            {selected && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                      {selected.full_name.charAt(0).toUpperCase()}
                    </div>
                    {selected.full_name}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Email</p>
                      <p className="font-medium">{selected.email ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Telefon</p>
                      <p className="font-medium">{selected.phone ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Partner</p>
                      <p className="font-medium">{selected.affiliate_links?.partners?.name ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Nieruchomość</p>
                      <p className="font-medium">{selected.affiliate_links?.property_name ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Kod linku</p>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{selected.affiliate_links?.tracking_code ?? "—"}</code>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Data kontaktu</p>
                      <p className="font-medium">{format(new Date(selected.created_at), "d MMM yyyy HH:mm", { locale: pl })}</p>
                    </div>
                  </div>
                  {selected.message && (
                    <div>
                      <p className="text-muted-foreground text-xs mb-1">Wiadomość</p>
                      <p className="text-sm bg-muted rounded-lg p-3">{selected.message}</p>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <Select value={selected.status} onValueChange={(v) => updateStatus(selected.id, v as "new" | "in_progress" | "deal_closed" | "no_deal")}>
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(statusConfig).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDetailOpen(false)}>Zamknij</Button>
                  {selected.status !== "deal_closed" && (
                    <Button onClick={() => openDealDialog(selected)} className="gap-2">
                      <TrendingUp className="h-4 w-4" /> Oznacz transakcję
                    </Button>
                  )}
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Deal dialog */}
        <Dialog open={dealOpen} onOpenChange={setDealOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                Oznacz transakcję jako zawartą
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCloseDeal} className="space-y-4">
              {selected && (
                <div className="rounded-lg bg-muted p-3 text-sm">
                  <p className="font-medium">{selected.full_name}</p>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    Partner: {selected.affiliate_links?.partners?.name ?? "—"} •{" "}
                    {selected.affiliate_links?.property_name ?? "link ogólny"}
                  </p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Wartość transakcji (PLN)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={dealForm.deal_value}
                    onChange={(e) => setDealForm({ ...dealForm, deal_value: e.target.value })}
                    placeholder="np. 850000"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Prowizja dla partnera (PLN)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={dealForm.commission_amount}
                    onChange={(e) => setDealForm({ ...dealForm, commission_amount: e.target.value })}
                    placeholder="np. 8500"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notatki</Label>
                <Textarea value={dealForm.notes} onChange={(e) => setDealForm({ ...dealForm, notes: e.target.value })} placeholder="Dodatkowe informacje o transakcji..." rows={2} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDealOpen(false)}>Anuluj</Button>
                <Button type="submit" disabled={saving} className="bg-green-600 hover:bg-green-700 text-white">
                  {saving ? "Zapisywanie..." : "Potwierdź transakcję"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
