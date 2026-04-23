import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Copy, Check, Link2, Pencil, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { pl } from "date-fns/locale";

interface Partner { id: string; name: string; }
interface Project { id: string; name: string; cities: string[]; }
interface LandingPage { id: string; title: string; }

interface AffiliateLink {
  id: string;
  partner_id: string;
  project_id: string | null;
  landing_page_id: string | null;
  destination_url: string | null;
  tracking_code: string;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
  partners: { name: string } | null;
  projects?: { name: string } | null;
}

function generateCode(partnerName: string, projectName?: string): string {
  const slug = (s: string) => s.toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (c) => ({ ą:"a",ć:"c",ę:"e",ł:"l",ń:"n",ó:"o",ś:"s",ź:"z",ż:"z" }[c] || c))
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 14);
  const prefix = slug(partnerName) || "partner";
  const mid = projectName ? "-" + slug(projectName).slice(0, 10) : "";
  const rand = Math.random().toString(36).slice(2, 6);
  return `${prefix}${mid}-${rand}`;
}

const emptyForm = {
  partner_id: "",
  project_id: "",
  destination_url: "",
  expires_at: "",
  landing_page_id: "",
};

export default function Links() {
  const { role } = useAuth();
  const { toast } = useToast();
  const [links, setLinks] = useState<AffiliateLink[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [landingPages, setLandingPages] = useState<LandingPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AffiliateLink | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [filterPartner, setFilterPartner] = useState("all");
  const isAdmin = role === "admin";

  const fetchAll = async () => {
    const [linksRes, partnersRes, projectsRes, lpRes] = await Promise.all([
      supabase.from("affiliate_links").select(`*, partners(name), projects(name)`).order("created_at", { ascending: false }),
      supabase.from("partners").select("id, name").eq("is_active", true).order("name"),
      supabase.from("projects").select("id, name, cities").eq("is_active", true).order("name"),
      supabase.from("landing_pages").select("id, title").eq("is_published", true).order("title"),
    ]);
    if (linksRes.data) setLinks(linksRes.data as AffiliateLink[]);
    if (partnersRes.data) setPartners(partnersRes.data);
    if (projectsRes.data) setProjects(projectsRes.data as Project[]);
    if (lpRes.data) setLandingPages(lpRes.data as LandingPage[]);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (l: AffiliateLink) => {
    setEditing(l);
    setForm({
      partner_id: l.partner_id,
      project_id: l.project_id ?? "",
      destination_url: l.destination_url ?? "",
      expires_at: l.expires_at ? l.expires_at.split("T")[0] : "",
      landing_page_id: l.landing_page_id ?? "",
    });
    setOpen(true);
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
    const partner = partners.find((p) => p.id === form.partner_id);
    const project = projects.find((p) => p.id === form.project_id);
    const code = editing?.tracking_code ?? generateCode(partner?.name ?? "LINK", project?.name);

    const payload = {
      partner_id: form.partner_id,
      project_id: form.project_id || null,
      property_name: project?.name || null,
      property_address: project?.cities?.join(", ") || null,
      link_type: "partner" as const,
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
    setSaving(false); setOpen(false); fetchAll();
  };

  const toggleActive = async (l: AffiliateLink) => {
    await supabase.from("affiliate_links").update({ is_active: !l.is_active }).eq("id", l.id);
    fetchAll();
  };

  const filtered = filterPartner === "all" ? links : links.filter((l) => l.partner_id === filterPartner);

  return (
    <AppShell>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Linki afiliacyjne</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Linki są przypisane do partnera i opcjonalnie do projektu</p>
          </div>
          {isAdmin && (
            <Button onClick={openCreate} className="gap-2">
              <Plus className="h-4 w-4" /> Nowy link
            </Button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Select value={filterPartner} onValueChange={setFilterPartner}>
            <SelectTrigger className="w-52"><SelectValue placeholder="Wszyscy partnerzy" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszyscy partnerzy</SelectItem>
              {partners.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
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
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Partner</TableHead>
                      <TableHead>Projekt</TableHead>
                      <TableHead>Kod śledzący</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead>Ważność</TableHead>
                      <TableHead className="text-right">Akcje</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="font-medium">{l.partners?.name ?? "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {l.projects?.name ?? <span className="text-xs italic">Ogólny</span>}
                        </TableCell>
                        <TableCell>
                          <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{l.tracking_code}</code>
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
                            <Button variant="ghost" size="sm" onClick={() => handleCopy(l.tracking_code)} className="h-8 w-8 p-0" title="Kopiuj">
                              {copied === l.tracking_code ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => window.open(buildTrackingUrl(l.tracking_code), "_blank")} className="h-8 w-8 p-0" title="Otwórz">
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
                  <SelectTrigger><SelectValue placeholder="Wybierz partnera" /></SelectTrigger>
                  <SelectContent>
                    {partners.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Projekt inwestycyjny (opcjonalnie)</Label>
                <Select value={form.project_id || "none"} onValueChange={(v) => setForm({ ...form, project_id: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Bez projektu (link ogólny)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Bez projektu —</SelectItem>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}{p.cities?.length ? ` • ${p.cities.join(", ")}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Landing Page (opcjonalnie)</Label>
                <Select value={form.landing_page_id || "none"} onValueChange={(v) => setForm({ ...form, landing_page_id: v === "none" ? "" : v, destination_url: v !== "none" ? "" : form.destination_url })}>
                  <SelectTrigger><SelectValue placeholder="Bez landing page" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Bez landing page —</SelectItem>
                    {landingPages.map((lp) => <SelectItem key={lp.id} value={lp.id}>{lp.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {!form.landing_page_id && (
                <div className="space-y-2">
                  <Label>Własny URL przekierowania (opcjonalnie)</Label>
                  <Input value={form.destination_url} onChange={(e) => setForm({ ...form, destination_url: e.target.value })} placeholder="https://..." />
                  <p className="text-xs text-muted-foreground">Pusty = wbudowany formularz kontaktowy</p>
                </div>
              )}

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
