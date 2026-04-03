import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Plus, Pencil, Building2, Percent, DollarSign, Users, Trash2, FileText } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { OfferAttachmentsDialog } from "@/components/OfferAttachmentsDialog";

interface Partner {
  id: string;
  name: string;
}

interface Offer {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  price: number | null;
  area_m2: number | null;
  offer_type: string;
  description: string | null;
  commission_type: string;
  commission_percent: number | null;
  commission_amount: number | null;
  is_active: boolean;
  created_at: string;
}

const emptyForm = {
  name: "",
  address: "",
  city: "",
  price: "",
  area_m2: "",
  offer_type: "sale",
  description: "",
  commission_type: "percent" as "percent" | "amount",
  commission_value: "",
};

const fmt = (n: number) =>
  new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", maximumFractionDigits: 0 }).format(n);

export default function Offers() {
  const { role } = useAuth();
  const { toast } = useToast();
  const isAdmin = role === "admin";
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Offer | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [filterActive, setFilterActive] = useState("all");
  const [allPartners, setAllPartners] = useState<Partner[]>([]);
  const [partnerDialogOffer, setPartnerDialogOffer] = useState<Offer | null>(null);
  const [assignedPartnerIds, setAssignedPartnerIds] = useState<string[]>([]);
  const [savingPartners, setSavingPartners] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Offer | null>(null);
  const [attachmentsOffer, setAttachmentsOffer] = useState<Offer | null>(null);

  const fetchOffers = async () => {
    const { data } = await supabase
      .from("offers")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setOffers(data as Offer[]);
    setLoading(false);
  };

  const fetchPartners = async () => {
    const { data } = await supabase.from("partners").select("id, name").eq("is_active", true).order("name");
    if (data) setAllPartners(data);
  };

  useEffect(() => { fetchOffers(); fetchPartners(); }, []);

  const openPartnerAssign = async (o: Offer) => {
    setPartnerDialogOffer(o);
    const { data } = await supabase.from("partner_offers").select("partner_id").eq("offer_id", o.id);
    setAssignedPartnerIds(data?.map((r) => r.partner_id) ?? []);
  };

  const togglePartner = (pid: string) => {
    setAssignedPartnerIds((prev) =>
      prev.includes(pid) ? prev.filter((id) => id !== pid) : [...prev, pid]
    );
  };

  const savePartnerAssignment = async () => {
    if (!partnerDialogOffer) return;
    setSavingPartners(true);
    const offerId = partnerDialogOffer.id;
    await supabase.from("partner_offers").delete().eq("offer_id", offerId);
    if (assignedPartnerIds.length > 0) {
      await supabase.from("partner_offers").insert(
        assignedPartnerIds.map((pid) => ({ partner_id: pid, offer_id: offerId }))
      );
    }
    toast({ title: "Partnerzy przypisani" });
    setSavingPartners(false);
    setPartnerDialogOffer(null);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (o: Offer) => {
    setEditing(o);
    const commType = (o.commission_type as "percent" | "amount") ?? "percent";
    setForm({
      name: o.name,
      address: o.address ?? "",
      city: o.city ?? "",
      price: o.price?.toString() ?? "",
      area_m2: o.area_m2?.toString() ?? "",
      offer_type: o.offer_type,
      description: o.description ?? "",
      commission_type: commType,
      commission_value: commType === "percent"
        ? (o.commission_percent?.toString() ?? "")
        : (o.commission_amount?.toString() ?? ""),
    });
    setOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) return;
    setSaving(true);

    const payload = {
      name: form.name,
      address: form.address || null,
      city: form.city || null,
      price: form.price ? parseFloat(form.price) : null,
      area_m2: form.area_m2 ? parseFloat(form.area_m2) : null,
      offer_type: form.offer_type,
      description: form.description || null,
      commission_type: form.commission_type,
      commission_percent: form.commission_type === "percent" && form.commission_value ? parseFloat(form.commission_value) : null,
      commission_amount: form.commission_type === "amount" && form.commission_value ? parseFloat(form.commission_value) : null,
    };

    if (editing) {
      const { error } = await supabase.from("offers").update(payload).eq("id", editing.id);
      if (error) toast({ title: "Błąd", description: error.message, variant: "destructive" });
      else toast({ title: "Oferta zaktualizowana" });
    } else {
      const { error } = await supabase.from("offers").insert(payload);
      if (error) toast({ title: "Błąd", description: error.message, variant: "destructive" });
      else toast({ title: "Oferta dodana" });
    }

    setSaving(false);
    setOpen(false);
    fetchOffers();
  };

  const toggleActive = async (o: Offer) => {
    await supabase.from("offers").update({ is_active: !o.is_active }).eq("id", o.id);
    fetchOffers();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await supabase.from("partner_offers").delete().eq("offer_id", deleteTarget.id);
    const { error } = await supabase.from("offers").delete().eq("id", deleteTarget.id);
    if (error) toast({ title: "Błąd", description: error.message, variant: "destructive" });
    else toast({ title: "Oferta usunięta" });
    setDeleteTarget(null);
    fetchOffers();
  };

  const getCommissionDisplay = (o: Offer) => {
    if (o.commission_type === "amount" && o.commission_amount != null) return fmt(o.commission_amount);
    if (o.commission_percent != null) return `${o.commission_percent}%`;
    return "—";
  };

  const filtered = filterActive === "all" ? offers : offers.filter((o) => String(o.is_active) === filterActive);

  return (
    <AppShell>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Oferty / Nieruchomości</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Zarządzaj ofertami dostępnymi przy tworzeniu linków</p>
          </div>
          {isAdmin && (
            <Button onClick={openCreate} className="gap-2">
              <Plus className="h-4 w-4" /> Nowa oferta
            </Button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Select value={filterActive} onValueChange={setFilterActive}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszystkie</SelectItem>
              <SelectItem value="true">Aktywne</SelectItem>
              <SelectItem value="false">Nieaktywne</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">{filtered.length} ofert</span>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Ładowanie...</div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center">
                <Building2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground">Brak ofert</p>
                <p className="text-xs text-muted-foreground mt-1">Dodaj pierwszą ofertę nieruchomości</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nazwa</TableHead>
                      <TableHead>Miasto</TableHead>
                      <TableHead>Typ</TableHead>
                      <TableHead className="text-right">Cena</TableHead>
                      <TableHead className="text-right">Prowizja</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      {isAdmin && <TableHead className="text-right">Akcje</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((o) => (
                      <TableRow key={o.id}>
                        <TableCell>
                          <button onClick={() => setAttachmentsOffer(o)} className="text-left hover:underline cursor-pointer">
                            <div className="font-medium">{o.name}</div>
                            {o.address && <div className="text-xs text-muted-foreground mt-0.5">{o.address}</div>}
                          </button>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{o.city ?? "—"}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium bg-muted text-foreground border-border">
                            {o.offer_type === "sale" ? "Sprzedaż" : o.offer_type === "rent" ? "Wynajem" : o.offer_type}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium">{o.price ? fmt(o.price) : "—"}</TableCell>
                        <TableCell className="text-right text-sm">
                          <div className="flex items-center justify-end gap-1">
                            {o.commission_type === "amount"
                              ? <DollarSign className="h-3 w-3 text-muted-foreground" />
                              : <Percent className="h-3 w-3 text-muted-foreground" />}
                            <span className="font-medium">{getCommissionDisplay(o)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${o.is_active ? "bg-green-50 text-green-700 border-green-200" : "bg-muted text-muted-foreground border-border"}`}>
                            {o.is_active ? "Aktywna" : "Nieaktywna"}
                          </span>
                        </TableCell>
                        {isAdmin && (
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={() => openEdit(o)} className="h-8 w-8 p-0">
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => openPartnerAssign(o)} className="h-8 w-8 p-0" title="Przypisz partnerów">
                                <Users className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => setAttachmentsOffer(o)} className="h-8 w-8 p-0" title="Pliki i linki">
                                <FileText className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => toggleActive(o)} className="h-8 px-2 text-xs">
                                {o.is_active ? "Wyłącz" : "Włącz"}
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(o)} className="h-8 w-8 p-0 text-destructive hover:text-destructive" title="Usuń ofertę">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing ? "Edytuj ofertę" : "Dodaj nową ofertę"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <Label>Nazwa oferty *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="np. Apartament Centrum Prestige" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Miasto</Label>
                  <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="np. Warszawa" />
                </div>
                <div className="space-y-2">
                  <Label>Typ oferty</Label>
                  <Select value={form.offer_type} onValueChange={(v) => setForm({ ...form, offer_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sale">Sprzedaż</SelectItem>
                      <SelectItem value="rent">Wynajem</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Adres</Label>
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="ul. Przykładowa 1/2" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Cena (PLN)</Label>
                  <Input type="number" min="0" step="1000" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="np. 850000" />
                </div>
                <div className="space-y-2">
                  <Label>Powierzchnia (m²)</Label>
                  <Input type="number" min="0" step="0.1" value={form.area_m2} onChange={(e) => setForm({ ...form, area_m2: e.target.value })} placeholder="np. 65" />
                </div>
              </div>

              {/* Commission block */}
              <div className="space-y-2">
                <Label>Prowizja dla partnera</Label>
                <div className="flex gap-2">
                  <div className="flex rounded-md border border-input overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, commission_type: "percent", commission_value: "" })}
                      className={`px-3 py-1.5 text-sm font-medium flex items-center gap-1.5 transition-colors ${form.commission_type === "percent" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
                    >
                      <Percent className="h-3.5 w-3.5" /> Procent
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, commission_type: "amount", commission_value: "" })}
                      className={`px-3 py-1.5 text-sm font-medium flex items-center gap-1.5 transition-colors ${form.commission_type === "amount" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
                    >
                      <DollarSign className="h-3.5 w-3.5" /> Kwota
                    </button>
                  </div>
                  <div className="relative flex-1">
                    <Input
                      type="number"
                      min="0"
                      step={form.commission_type === "percent" ? "0.1" : "100"}
                      max={form.commission_type === "percent" ? "100" : undefined}
                      value={form.commission_value}
                      onChange={(e) => setForm({ ...form, commission_value: e.target.value })}
                      placeholder={form.commission_type === "percent" ? "np. 2.5" : "np. 8500"}
                      className="pr-10"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">
                      {form.commission_type === "percent" ? "%" : "PLN"}
                    </span>
                  </div>
                </div>
                {form.commission_type === "percent" && form.commission_value && form.price && (
                  <p className="text-xs text-muted-foreground">
                    = {fmt((parseFloat(form.price) * parseFloat(form.commission_value)) / 100)} przy podanej cenie
                  </p>
                )}
                <p className="text-xs text-muted-foreground">Prowizja zostanie auto-uzupełniona przy zamknięciu transakcji</p>
              </div>

              <div className="space-y-2">
                <Label>Opis (opcjonalnie)</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Dodatkowe informacje o ofercie..." rows={2} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Anuluj</Button>
                <Button type="submit" disabled={saving || !form.name}>{saving ? "Zapisywanie..." : "Zapisz"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Partner assignment dialog */}
        <Dialog open={!!partnerDialogOffer} onOpenChange={(o) => !o && setPartnerDialogOffer(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Przypisz partnerów do oferty</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">{partnerDialogOffer?.name}</p>
            {allPartners.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">Brak aktywnych partnerów.</p>
            ) : (
              <div className="max-h-60 overflow-y-auto rounded-md border border-input p-2 space-y-1">
                {allPartners.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 hover:bg-muted text-sm">
                    <Checkbox
                      checked={assignedPartnerIds.includes(p.id)}
                      onCheckedChange={() => togglePartner(p.id)}
                    />
                    <span>{p.name}</span>
                  </label>
                ))}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setPartnerDialogOffer(null)}>Anuluj</Button>
              <Button onClick={savePartnerAssignment} disabled={savingPartners}>
                {savingPartners ? "Zapisywanie..." : "Zapisz"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete confirmation */}
        <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Usunąć ofertę?</AlertDialogTitle>
              <AlertDialogDescription>
                Oferta „{deleteTarget?.name}" zostanie trwale usunięta wraz z przypisaniami do partnerów. Tej operacji nie można cofnąć.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Anuluj</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Usuń
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppShell>
  );
}
