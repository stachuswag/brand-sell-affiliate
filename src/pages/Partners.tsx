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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Building, Mail, Phone, Link2, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Partner {
  id: string;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  link_count?: number;
  contact_count?: number;
}

const emptyForm = { name: "", contact_person: "", email: "", phone: "", notes: "" };

export default function Partners() {
  const { role } = useAuth();
  const { toast } = useToast();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partner | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletePartner, setDeletePartner] = useState<Partner | null>(null);
  const isAdmin = role === "admin";

  const fetchPartners = async () => {
    const { data } = await supabase
      .from("partners")
      .select(`
        *,
        affiliate_links(count),
        contacts:affiliate_links(contacts(count))
      `)
      .order("created_at", { ascending: false });

    if (data) {
      // Get link counts per partner
      const { data: linkCounts } = await supabase
        .from("affiliate_links")
        .select("partner_id");

      const countsByPartner: Record<string, number> = {};
      linkCounts?.forEach((l) => {
        countsByPartner[l.partner_id] = (countsByPartner[l.partner_id] ?? 0) + 1;
      });

      setPartners(data.map((p) => ({ ...p, link_count: countsByPartner[p.id] ?? 0 })));
    }
    setLoading(false);
  };

  useEffect(() => { fetchPartners(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (p: Partner) => {
    setEditing(p);
    setForm({
      name: p.name,
      contact_person: p.contact_person ?? "",
      email: p.email ?? "",
      phone: p.phone ?? "",
      notes: p.notes ?? "",
    });
    setOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);

    if (editing) {
      const { error } = await supabase
        .from("partners")
        .update({ name: form.name, contact_person: form.contact_person || null, email: form.email || null, phone: form.phone || null, notes: form.notes || null })
        .eq("id", editing.id);
      if (error) toast({ title: "Błąd", description: error.message, variant: "destructive" });
      else toast({ title: "Zaktualizowano partnera" });
    } else {
      const { error } = await supabase
        .from("partners")
        .insert({ name: form.name, contact_person: form.contact_person || null, email: form.email || null, phone: form.phone || null, notes: form.notes || null });
      if (error) toast({ title: "Błąd", description: error.message, variant: "destructive" });
      else toast({ title: "Dodano partnera" });
    }

    setSaving(false);
    setOpen(false);
    fetchPartners();
  };

  const toggleActive = async (p: Partner) => {
    await supabase.from("partners").update({ is_active: !p.is_active }).eq("id", p.id);
    fetchPartners();
  };

  return (
    <AppShell>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Partnerzy</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Zarządzaj firmami partnerskimi</p>
          </div>
          {isAdmin && (
            <Button onClick={openCreate} className="gap-2">
              <Plus className="h-4 w-4" /> Dodaj partnera
            </Button>
          )}
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Ładowanie...</div>
            ) : partners.length === 0 ? (
              <div className="p-12 text-center">
                <Building className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground">Brak partnerów</p>
                <p className="text-xs text-muted-foreground mt-1">Dodaj pierwszą firmę partnerską</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Firma</TableHead>
                      <TableHead>Osoba kontaktowa</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Telefon</TableHead>
                      <TableHead className="text-center">Linki</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      {isAdmin && <TableHead className="text-right">Akcje</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {partners.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="text-muted-foreground">{p.contact_person ?? "—"}</TableCell>
                        <TableCell>
                          {p.email ? (
                            <a href={`mailto:${p.email}`} className="flex items-center gap-1.5 text-primary hover:underline text-sm">
                              <Mail className="h-3.5 w-3.5" />{p.email}
                            </a>
                          ) : "—"}
                        </TableCell>
                        <TableCell>
                          {p.phone ? (
                            <a href={`tel:${p.phone}`} className="flex items-center gap-1.5 text-sm hover:underline">
                              <Phone className="h-3.5 w-3.5" />{p.phone}
                            </a>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="inline-flex items-center gap-1 text-sm">
                            <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                            {p.link_count ?? 0}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${p.is_active ? "bg-green-50 text-green-700 border-green-200" : "bg-muted text-muted-foreground border-border"}`}>
                            {p.is_active ? "Aktywny" : "Nieaktywny"}
                          </span>
                        </TableCell>
                        {isAdmin && (
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button variant="ghost" size="sm" onClick={() => openEdit(p)} className="h-8 w-8 p-0">
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleActive(p)}
                                className="h-8 px-2 text-xs"
                              >
                                {p.is_active ? "Deaktywuj" : "Aktywuj"}
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
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editing ? "Edytuj partnera" : "Dodaj partnera"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="p-name">Nazwa firmy *</Label>
                <Input id="p-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="np. Uniestates" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-contact">Osoba kontaktowa</Label>
                <Input id="p-contact" value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} placeholder="Jan Kowalski" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="p-email">Email</Label>
                  <Input id="p-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="kontakt@firma.pl" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-phone">Telefon</Label>
                  <Input id="p-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+48 123 456 789" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-notes">Notatki</Label>
                <Textarea id="p-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Dodatkowe informacje..." rows={3} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Anuluj</Button>
                <Button type="submit" disabled={saving}>{saving ? "Zapisywanie..." : "Zapisz"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
