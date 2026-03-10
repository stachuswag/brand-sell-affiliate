import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
import { Plus, Pencil, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Offer {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  price: number | null;
  area_m2: number | null;
  offer_type: string;
  description: string | null;
  commission_percent: number | null;
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
  commission_percent: "",
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

  const fetchOffers = async () => {
    const { data } = await supabase
      .from("offers")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setOffers(data as Offer[]);
    setLoading(false);
  };

  useEffect(() => { fetchOffers(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (o: Offer) => {
    setEditing(o);
    setForm({
      name: o.name,
      address: o.address ?? "",
      city: o.city ?? "",
      price: o.price?.toString() ?? "",
      area_m2: o.area_m2?.toString() ?? "",
      offer_type: o.offer_type,
      description: o.description ?? "",
      commission_percent: o.commission_percent?.toString() ?? "",
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
      commission_percent: form.commission_percent ? parseFloat(form.commission_percent) : null,
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
                      <TableHead>Adres</TableHead>
                      <TableHead>Typ</TableHead>
                      <TableHead className="text-right">Powierzchnia</TableHead>
                      <TableHead className="text-right">Cena</TableHead>
                      <TableHead className="text-right">Prowizja</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      {isAdmin && <TableHead className="text-right">Akcje</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((o) => (
                      <TableRow key={o.id}>
                        <TableCell className="font-medium">{o.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{o.city ?? "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{o.address ?? "—"}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium bg-muted text-foreground border-border">
                            {o.offer_type === "sale" ? "Sprzedaż" : o.offer_type === "rent" ? "Wynajem" : o.offer_type}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-sm">{o.area_m2 ? `${o.area_m2} m²` : "—"}</TableCell>
                         <TableCell className="text-right text-sm font-medium">{o.price ? fmt(o.price) : "—"}</TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {o.commission_percent != null ? `${o.commission_percent}%` : "—"}
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
                              <Button variant="ghost" size="sm" onClick={() => toggleActive(o)} className="h-8 px-2 text-xs">
                                {o.is_active ? "Wyłącz" : "Włącz"}
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
              <div className="space-y-2">
                <Label>Prowizja dla partnera (%)</Label>
                <div className="relative">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={form.commission_percent}
                    onChange={(e) => setForm({ ...form, commission_percent: e.target.value })}
                    placeholder="np. 2.5"
                    className="pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                </div>
                <p className="text-xs text-muted-foreground">Prowizja zostanie automatycznie zaproponowana przy zamknięciu transakcji</p>
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
      </div>
    </AppShell>
  );
}
