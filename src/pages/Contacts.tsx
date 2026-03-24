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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { UserCheck, TrendingUp, Filter, Phone, CheckCircle, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";

interface Transaction {
  id: string;
  contact_id: string;
  commission_amount: number | null;
  commission_paid: boolean;
  deal_value: number | null;
}

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
    offer_id: string | null;
    partners: { name: string } | null;
  } | null;
}

const statusConfig = {
  new: { label: "Nowy", className: "bg-blue-50 text-blue-700 border-blue-200" },
  in_progress: { label: "W trakcie", className: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  deal_closed: { label: "Transakcja zawarta", className: "bg-green-50 text-green-700 border-green-200" },
  no_deal: { label: "Brak transakcji", className: "bg-red-50 text-red-700 border-red-200" },
};

const fmt = (n: number) =>
  new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", maximumFractionDigits: 0 }).format(n);

export default function Contacts() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Contact | null>(null);
  const [deleteContact, setDeleteContact] = useState<Contact | null>(null);
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
      .select(`*, affiliate_links(tracking_code, property_name, link_type, offer_id, partners(name))`)
      .order("created_at", { ascending: false });
    if (data) setContacts(data as any);
    setLoading(false);
  };

  const fetchTransactions = async () => {
    const { data } = await supabase.from("transactions").select("id, contact_id, commission_amount, commission_paid, deal_value");
    if (data) setTransactions(data as Transaction[]);
  };

  const fetchPartners = async () => {
    const { data } = await supabase.from("partners").select("id, name").order("name");
    if (data) setPartners(data);
  };

  const markCommissionPaid = async (contactId: string, paid: boolean) => {
    const tx = transactions.find((t) => t.contact_id === contactId);
    if (!tx) return;
    await supabase.from("transactions").update({ commission_paid: paid }).eq("id", tx.id);
    toast({ title: paid ? "Prowizja oznaczona jako opłacona ✓" : "Prowizja oznaczona jako nieopłacona" });
    fetchTransactions();
  };

  const openDealDialog = async (c: Contact) => {
    setSelected(c);
    let autoCommission = "";
    if (c.affiliate_links?.offer_id) {
      const { data: offer } = await supabase
        .from("offers")
        .select("commission_type, commission_percent, commission_amount, price")
        .eq("id", c.affiliate_links.offer_id)
        .single();
      if (offer) {
        if (offer.commission_type === "amount" && offer.commission_amount != null) {
          autoCommission = offer.commission_amount.toFixed(0);
        } else if (offer.commission_percent != null && offer.price != null) {
          autoCommission = ((offer.price * offer.commission_percent) / 100).toFixed(0);
        }
      }
    }
    setDealForm({ deal_value: "", commission_amount: autoCommission, notes: "" });
    setDealOpen(true);
    setDetailOpen(false);
  };

  useEffect(() => {
    fetchContacts();
    fetchPartners();
    fetchTransactions();
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

  const handleCloseDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);

    await supabase.from("contacts").update({ status: "deal_closed" }).eq("id", selected.id);

    const { error } = await supabase.from("transactions").insert({
      contact_id: selected.id,
      affiliate_link_id: selected.affiliate_link_id,
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
    fetchTransactions();
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
                      const tx = transactions.find((t) => t.contact_id === c.id);
                      return (
                        <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openDetail(c)}>
                          <TableCell className="font-medium">{c.full_name}</TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <div className="text-sm space-y-0.5">
                              {c.email && <div className="text-muted-foreground">{c.email}</div>}
                              {c.phone && (
                                <a
                                  href={`tel:${c.phone}`}
                                  className="flex items-center gap-1 text-primary hover:underline font-medium"
                                  title="Zadzwoń"
                                >
                                  <Phone className="h-3 w-3" />
                                  {c.phone}
                                </a>
                              )}
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
                            <div className="flex items-center justify-end gap-1 flex-wrap">
                              {/* Call button */}
                              {c.phone && (
                                <a href={`tel:${c.phone}`} title="Zadzwoń">
                                  <Button size="sm" variant="outline" className="h-7 w-7 p-0">
                                    <Phone className="h-3 w-3" />
                                  </Button>
                                </a>
                              )}
                              {/* Deal button */}
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
                              {/* Commission paid toggle */}
                              {c.status === "deal_closed" && tx && (
                                <Button
                                  size="sm"
                                  variant={tx.commission_paid ? "outline" : "default"}
                                  className={`h-7 px-2 text-xs gap-1 ${tx.commission_paid ? "text-muted-foreground border-border" : "bg-primary text-primary-foreground"}`}
                                  onClick={() => markCommissionPaid(c.id, !tx.commission_paid)}
                                  title={tx.commission_paid ? "Kliknij aby cofnąć" : "Oznacz prowizję jako opłaconą"}
                                >
                                  {tx.commission_paid ? (
                                    <><CheckCircle className="h-3 w-3 text-success" /> Opłacona</>
                                  ) : (
                                    <>Prowizja nieopłacona</>
                                  )}
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
            {selected && (() => {
              const tx = transactions.find((t) => t.contact_id === selected.id);
              return (
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
                        {selected.phone ? (
                          <a href={`tel:${selected.phone}`} className="font-medium text-primary flex items-center gap-1 hover:underline">
                            <Phone className="h-3.5 w-3.5" /> {selected.phone}
                          </a>
                        ) : <p className="font-medium">—</p>}
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

                    {/* Commission info if deal closed */}
                    {tx && (
                      <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
                        <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Transakcja</p>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <p className="text-muted-foreground text-xs">Wartość</p>
                            <p className="font-medium">{tx.deal_value ? fmt(tx.deal_value) : "—"}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs">Prowizja</p>
                            <p className="font-medium">{tx.commission_amount ? fmt(tx.commission_amount) : "—"}</p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant={tx.commission_paid ? "outline" : "default"}
                          className={`w-full gap-2 ${tx.commission_paid ? "border-success text-success hover:bg-success/10" : ""}`}
                          onClick={() => markCommissionPaid(selected.id, !tx.commission_paid)}
                        >
                          <CheckCircle className="h-4 w-4" />
                          {tx.commission_paid ? "Prowizja opłacona — kliknij aby cofnąć" : "Oznacz prowizję jako opłaconą"}
                        </Button>
                      </div>
                    )}

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
                    {selected.phone && (
                      <a href={`tel:${selected.phone}`}>
                        <Button variant="outline" className="gap-2">
                          <Phone className="h-4 w-4" /> Zadzwoń
                        </Button>
                      </a>
                    )}
                    {selected.status !== "deal_closed" && (
                      <Button onClick={() => openDealDialog(selected)} className="gap-2">
                        <TrendingUp className="h-4 w-4" /> Oznacz transakcję
                      </Button>
                    )}
                  </DialogFooter>
                </>
              );
            })()}
          </DialogContent>
        </Dialog>

        {/* Deal dialog */}
        <Dialog open={dealOpen} onOpenChange={setDealOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-success" />
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
                  {dealForm.commission_amount && selected?.affiliate_links?.offer_id && (
                    <p className="text-xs text-success">✓ Auto-uzupełniono z oferty</p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notatki</Label>
                <Textarea value={dealForm.notes} onChange={(e) => setDealForm({ ...dealForm, notes: e.target.value })} placeholder="Dodatkowe informacje o transakcji..." rows={2} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDealOpen(false)}>Anuluj</Button>
                <Button type="submit" disabled={saving} className="gap-2">
                  <CheckCircle className="h-4 w-4" />
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
