import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus, Copy, Check, Link2, Pencil, ExternalLink, LayoutTemplate } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { pl } from "date-fns/locale";

interface Partner {
  id: string;
  name: string;
}

interface Offer {
  id: string;
  name: string;
  city: string | null;
  address: string | null;
}

interface LandingPage {
  id: string;
  title: string;
}

interface AffiliateLink {
  id: string;
  partner_id: string;
  link_type: "partner" | "property";
  property_name: string | null;
  property_address: string | null;
  destination_url: string | null;
  tracking_code: string;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
  offer_id: string | null;
  landing_page_id: string | null;
  partners: { name: string } | null;
  click_count?: number;
  contact_count?: number;
}

function generateCode(partnerName: string, property?: string): string {
  const prefix = partnerName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 7);
  const suffix = property
    ? property.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) + "-"
    : "";
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${suffix}${rand}`;
}

const emptyForm = {
  partner_id: "",
  link_type: "partner" as "partner" | "property",
  offer_id: "",
  property_name: "",
  property_address: "",
  destination_url: "",
  expires_at: "",
  landing_page_id: "",
};

export default function Links() {
  const { role } = useAuth();
  const { toast } = useToast();
  const [links, setLinks] = useState<AffiliateLink[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [landingPages, setLandingPages] = useState<LandingPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AffiliateLink | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [filterPartner, setFilterPartner] = useState("all");
  const isAdmin = role === "admin";

  const fetchLinks = async () => {
    const { data } = await supabase
      .from("affiliate_links")
      .select(`*, partners(name)`)
      .order("created_at", { ascending: false });
    if (data) setLinks(data as AffiliateLink[]);
    setLoading(false);
  };

  const fetchPartners = async () => {
    const { data } = await supabase.from("partners").select("id, name").eq("is_active", true).order("name");
    if (data) setPartners(data);
  };

  const fetchOffers = async () => {
    const { data } = await supabase.from("offers").select("id, name, city, address").eq("is_active", true).order("name");
    if (data) setOffers(data as Offer[]);
  };

  const fetchLandingPages = async () => {
    const { data } = await supabase.from("landing_pages").select("id, title").eq("is_published", true).order("title");
    if (data) setLandingPages(data as LandingPage[]);
  };

  useEffect(() => {
    fetchLinks();
    fetchPartners();
    fetchOffers();
    fetchLandingPages();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (l: AffiliateLink) => {
    setEditing(l);
    setForm({
      partner_id: l.partner_id,
      link_type: l.link_type,
      offer_id: l.offer_id ?? "",
      property_name: l.property_name ?? "",
      property_address: l.property_address ?? "",
      destination_url: l.destination_url ?? "",
      expires_at: l.expires_at ? l.expires_at.split("T")[0] : "",
      landing_page_id: l.landing_page_id ?? "",
    });
    setOpen(true);
  };

  // When an offer is selected, auto-fill property fields
  const handleOfferSelect = (offerId: string) => {
    if (offerId === "manual") {
      setForm({ ...form, offer_id: "", property_name: "", property_address: "" });
      return;
    }
    const offer = offers.find((o) => o.id === offerId);
    if (offer) {
      setForm({
        ...form,
        offer_id: offerId,
        property_name: offer.name,
        property_address: [offer.address, offer.city].filter(Boolean).join(", "),
      });
    }
  };

  const buildTrackingUrl = (code: string) => `${window.location.origin}/c/${code}`;

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(buildTrackingUrl(code));
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
    toast({ title: "Link skopiowany!" });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.partner_id) return;
    setSaving(true);

    const selectedPartner = partners.find((p) => p.id === form.partner_id);
    const code = editing?.tracking_code ?? generateCode(selectedPartner?.name ?? "LINK", form.property_name);

    const payload = {
      partner_id: form.partner_id,
      link_type: form.link_type,
      offer_id: form.offer_id || null,
      property_name: form.property_name || null,
      property_address: form.property_address || null,
      destination_url: form.destination_url || null,
      expires_at: form.expires_at || null,
      landing_page_id: form.landing_page_id || null,
    };

    if (editing) {
      const { error } = await supabase.from("affiliate_links").update(payload).eq("id", editing.id);
      if (error) toast({ title: "Błąd", description: error.message, variant: "destructive" });
      else toast({ title: "Link zaktualizowany" });
    } else {
      const { error } = await supabase.from("affiliate_links").insert({ ...payload, tracking_code: code });
      if (error) toast({ title: "Błąd", description: error.message, variant: "destructive" });
      else toast({ title: "Link utworzony" });
    }

    setSaving(false);
    setOpen(false);
    fetchLinks();
  };

  const toggleActive = async (l: AffiliateLink) => {
    await supabase.from("affiliate_links").update({ is_active: !l.is_active }).eq("id", l.id);
    fetchLinks();
  };

  const filtered = filterPartner === "all" ? links : links.filter((l) => l.partner_id === filterPartner);

  return (
    <AppShell>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Linki afiliacyjne</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Twórz i zarządzaj linkami śledzącymi</p>
          </div>
          {isAdmin && (
            <Button onClick={openCreate} className="gap-2">
              <Plus className="h-4 w-4" /> Nowy link
            </Button>
          )}
        </div>

        {/* Filter */}
        <div className="flex items-center gap-3">
          <Select value={filterPartner} onValueChange={setFilterPartner}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Wszyscy partnerzy" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszyscy partnerzy</SelectItem>
              {partners.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">{filtered.length} linków</span>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Ładowanie...</div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center">
                <Link2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground">Brak linków</p>
                <p className="text-xs text-muted-foreground mt-1">Utwórz pierwszy link afiliacyjny</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Partner</TableHead>
                      <TableHead>Typ</TableHead>
                      <TableHead>Nieruchomość</TableHead>
                      <TableHead>Kod śledzący</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead>Data ważności</TableHead>
                      <TableHead className="text-right">Akcje</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="font-medium">{l.partners?.name ?? "—"}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${l.link_type === "property" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-purple-50 text-purple-700 border-purple-200"}`}>
                            {l.link_type === "property" ? "Oferta" : "Ogólny"}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {l.property_name ?? "—"}
                        </TableCell>
                        <TableCell>
                          <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                            {l.tracking_code}
                          </code>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${l.is_active ? "bg-green-50 text-green-700 border-green-200" : "bg-muted text-muted-foreground border-border"}`}>
                            {l.is_active ? "Aktywny" : "Nieaktywny"}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {l.expires_at ? format(new Date(l.expires_at), "d MMM yyyy", { locale: pl }) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => handleCopy(l.tracking_code)} className="h-8 w-8 p-0" title="Kopiuj link">
                              {copied === l.tracking_code ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => window.open(buildTrackingUrl(l.tracking_code), "_blank")} className="h-8 w-8 p-0" title="Otwórz link">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                            {isAdmin && (
                              <>
                                <Button variant="ghost" size="sm" onClick={() => openEdit(l)} className="h-8 w-8 p-0">
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => toggleActive(l)} className="h-8 px-2 text-xs">
                                  {l.is_active ? "Wyłącz" : "Włącz"}
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
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
              <DialogTitle>{editing ? "Edytuj link" : "Utwórz link afiliacyjny"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <Label>Partner *</Label>
                <Select value={form.partner_id} onValueChange={(v) => setForm({ ...form, partner_id: v })} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Wybierz partnera" />
                  </SelectTrigger>
                  <SelectContent>
                    {partners.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Typ linku</Label>
                <Select value={form.link_type} onValueChange={(v) => setForm({ ...form, link_type: v as "partner" | "property", offer_id: "", property_name: "", property_address: "" })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="partner">Ogólny (dla firmy partnerskiej)</SelectItem>
                    <SelectItem value="property">Per oferta/nieruchomość</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.link_type === "property" && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Wybierz ofertę z bazy</Label>
                    <Select value={form.offer_id || "manual"} onValueChange={handleOfferSelect}>
                      <SelectTrigger>
                        <SelectValue placeholder="Wybierz ofertę lub wpisz ręcznie" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">— Wpisz ręcznie —</SelectItem>
                        {offers.map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.name}{o.city ? ` • ${o.city}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Nazwa nieruchomości</Label>
                      <Input value={form.property_name} onChange={(e) => setForm({ ...form, property_name: e.target.value, offer_id: "" })} placeholder="np. Apartament Centrum" />
                    </div>
                    <div className="space-y-2">
                      <Label>Adres</Label>
                      <Input value={form.property_address} onChange={(e) => setForm({ ...form, property_address: e.target.value, offer_id: "" })} placeholder="ul. Marszałkowska 1" />
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Przekierowanie po kliknięciu linku</Label>
                <div className="rounded-lg border bg-muted/50 px-3 py-2.5 flex items-start gap-2">
                  <span className="h-2 w-2 rounded-full bg-success flex-shrink-0 mt-1.5" />
                  <div className="text-xs text-foreground">
                    <span className="font-medium">Wbudowany formularz kontaktowy</span>
                    <span className="text-muted-foreground"> — klient wypełnia formularz, Ty dostajesz powiadomienie</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Lub wpisz własny URL (opcjonalnie):</p>
                  <Input value={form.destination_url} onChange={(e) => setForm({ ...form, destination_url: e.target.value })} placeholder="https://brandsell.pl/kontakt (opcjonalnie)" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Data ważności (opcjonalnie)</Label>
                <Input type="date" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Anuluj</Button>
                <Button type="submit" disabled={saving || !form.partner_id}>{saving ? "Zapisywanie..." : "Zapisz"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
