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
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Building, Mail, Phone, Link2, Trash2, Sparkles, Rocket, Eye, EyeOff, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

type OnboardEmailType = "onboard" | "offer" | "general" | "follow_up" | "proposal" | "question";

interface Offer { id: string; name: string; city: string | null; }
interface Project { id: string; name: string; cities: string[]; }
interface Partner {
  id: string; name: string; contact_person: string | null; email: string | null;
  phone: string | null; notes: string | null; is_active: boolean;
  agent_user_id: string | null; parent_partner_id: string | null; created_at: string;
  link_count?: number;
  linkedin_url?: string | null; instagram_url?: string | null;
  clay_icebreaker?: string | null; clay_summary?: string | null;
  clay_enriched_at?: string | null; agent_status?: string | null;
  login_email?: string | null;
}

const emptyForm = { name: "", contact_person: "", email: "", phone: "", notes: "", password: "", login_email: "" };

const emailTypeOptions: { value: OnboardEmailType; label: string; description: string; icon: string }[] = [
  { value: "onboard", label: "Onboarding", description: "zatwierdzenie agenta", icon: "🚀" },
  { value: "offer", label: "Oferta", description: "mail o konkretnej ofercie", icon: "📋" },
  { value: "general", label: "Ogólny", description: "podziękowanie i link afiliacyjny", icon: "✉️" },
  { value: "follow_up", label: "Follow-up", description: "krótkie przypomnienie", icon: "🔄" },
  { value: "proposal", label: "Propozycja", description: "własna propozycja współpracy", icon: "💡" },
  { value: "question", label: "Pytanie", description: "wiadomość z pytaniem", icon: "❓" },
];

const emailTypeSuccessLabels: Record<OnboardEmailType, string> = {
  onboard: "Onboarding wysłany! 🚀",
  offer: "Email o ofercie wysłany! 📋",
  general: "Email wysłany! ✉️",
  follow_up: "Follow-up wysłany! 🔄",
  proposal: "Propozycja wysłana! 💡",
  question: "Pytanie wysłane! ❓",
};

export default function Partners() {
  const { role } = useAuth();
  const { toast } = useToast();
  const isAdmin = role === "admin";

  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partner | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletePartner, setDeletePartner] = useState<Partner | null>(null);
  const [allOffers, setAllOffers] = useState<Offer[]>([]);
  const [selectedOfferIds, setSelectedOfferIds] = useState<string[]>([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);

  // Clay + Onboard
  const [enrichingId, setEnrichingId] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [onboardOpen, setOnboardOpen] = useState(false);
  const [onboardPartner, setOnboardPartner] = useState<Partner | null>(null);
  const [onboardProjectId, setOnboardProjectId] = useState("");
  const [onboardOfferId, setOnboardOfferId] = useState("");
  const [onboardEmailType, setOnboardEmailType] = useState<OnboardEmailType>("onboard");
  const [onboardCustomMsg, setOnboardCustomMsg] = useState("");
  const [onboardPassword, setOnboardPassword] = useState("");
  const [onboarding, setOnboarding] = useState(false);
  const [clayDetail, setClayDetail] = useState<Partner | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const fetchPartners = async () => {
    const { data } = await supabase
      .from("partners")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) {
      const { data: linkCounts } = await supabase.from("affiliate_links").select("partner_id");
      const countsByPartner: Record<string, number> = {};
      linkCounts?.forEach((l) => { countsByPartner[l.partner_id] = (countsByPartner[l.partner_id] ?? 0) + 1; });
      setPartners(data.map((p) => ({ ...p, link_count: countsByPartner[p.id] ?? 0 })));
    }
    setLoading(false);
  };

  const fetchOffers = async () => {
    const { data } = await supabase.from("offers").select("id, name, city").eq("is_active", true).order("name");
    if (data) setAllOffers(data);
  };

  const fetchProjects = async () => {
    const { data } = await supabase.from("projects").select("id, name, cities").eq("is_active", true).order("name");
    if (data) setProjects(data as Project[]);
  };

  const fetchPartnerOffers = async (partnerId: string) => {
    const { data } = await supabase.from("partner_offers").select("offer_id").eq("partner_id", partnerId);
    setSelectedOfferIds(data?.map((r) => r.offer_id) ?? []);
  };

  const fetchPartnerProjects = async (partnerId: string) => {
    const { data } = await supabase.from("partner_projects").select("project_id").eq("partner_id", partnerId);
    setSelectedProjectIds(data?.map((r) => r.project_id) ?? []);
  };

  useEffect(() => { fetchPartners(); fetchOffers(); fetchProjects(); }, []);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setSelectedOfferIds([]); setSelectedProjectIds([]); setOpen(true); };
  const openEdit = async (p: Partner) => {
    setEditing(p);
    setForm({ name: p.name, contact_person: p.contact_person ?? "", email: p.email ?? "", phone: p.phone ?? "", notes: p.notes ?? "", password: "", login_email: p.login_email ?? "" });
    await Promise.all([fetchPartnerOffers(p.id), fetchPartnerProjects(p.id)]);
    setOpen(true);
  };
  const toggleOffer = (offerId: string) => setSelectedOfferIds((prev) => prev.includes(offerId) ? prev.filter((id) => id !== offerId) : [...prev, offerId]);
  const toggleProject = (projectId: string) => setSelectedProjectIds((prev) => prev.includes(projectId) ? prev.filter((id) => id !== projectId) : [...prev, projectId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    let partnerId = editing?.id;
    if (editing) {
      const { error } = await supabase.from("partners").update({ name: form.name, contact_person: form.contact_person || null, email: form.email || null, phone: form.phone || null, notes: form.notes || null }).eq("id", editing.id);
      if (error) { toast({ title: "Błąd", description: error.message, variant: "destructive" }); setSaving(false); return; }
      toast({ title: "Zaktualizowano partnera" });
    } else {
      if (!form.login_email || !form.password) {
        toast({ title: "Błąd", description: "Login (email do panelu) i hasło są wymagane przy tworzeniu partnera", variant: "destructive" });
        setSaving(false);
        return;
      }
      const { data, error } = await supabase.from("partners").insert({ name: form.name, contact_person: form.contact_person || null, email: form.email || null, phone: form.phone || null, notes: form.notes || null }).select("id").single();
      if (error) { toast({ title: "Błąd", description: error.message, variant: "destructive" }); setSaving(false); return; }
      partnerId = data.id;

      // Auto-create agent account using login_email
      const { data: { session } } = await supabase.auth.getSession();
      try {
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-agent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}`, "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
          body: JSON.stringify({ action: "create", partner_id: partnerId, partner_name: form.name, email: form.login_email, password: form.password }),
        });
        const result = await res.json();
        if (!res.ok || result.error) {
          toast({ title: "Partner dodany, ale błąd konta", description: result.error, variant: "destructive" });
        } else {
          toast({ title: "Partner dodany + konto utworzone! 🎉" });
        }
      } catch {
        toast({ title: "Partner dodany, ale błąd tworzenia konta", variant: "destructive" });
      }
    }
    if (partnerId) {
      await supabase.from("partner_offers").delete().eq("partner_id", partnerId);
      if (selectedOfferIds.length > 0) await supabase.from("partner_offers").insert(selectedOfferIds.map((oid) => ({ partner_id: partnerId!, offer_id: oid })));
    }
    setSaving(false); setOpen(false); fetchPartners();
  };

  const toggleActive = async (p: Partner) => { await supabase.from("partners").update({ is_active: !p.is_active }).eq("id", p.id); fetchPartners(); };

  const handleDeletePartner = async () => {
    if (!deletePartner) return;
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-agent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}`, "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
      body: JSON.stringify({ action: "delete", partner_id: deletePartner.id, user_id: deletePartner.agent_user_id }),
    });
    const result = await res.json();
    if (!res.ok || result.error) toast({ title: "Błąd", description: result.error, variant: "destructive" });
    else { toast({ title: "Partner usunięty z systemu" }); fetchPartners(); }
    setDeletePartner(null);
  };

  // Clay enrichment
  const handleEnrich = async (p: Partner) => {
    setEnrichingId(p.id);
    const { data: { session } } = await supabase.auth.getSession();
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/clay-enrich`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}`, "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ partner_id: p.id, name: p.name, email: p.email, linkedin_url: p.linkedin_url }),
      });
      const result = await res.json();
      if (!res.ok || result.error) toast({ title: "Błąd Clay", description: result.error, variant: "destructive" });
      else { toast({ title: "Dane wzbogacone!", description: "Clay + AI lodołamacz wygenerowany" }); fetchPartners(); }
    } catch { toast({ title: "Błąd połączenia z Clay", variant: "destructive" }); }
    setEnrichingId(null);
  };

  // One button - onboard
  const resetOnboardForm = (type: OnboardEmailType = "onboard") => {
    setOnboardProjectId("");
    setOnboardOfferId("");
    setOnboardEmailType(type);
    setOnboardCustomMsg("");
    setOnboardPassword("");
  };

  const generatePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#";
    return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  };

  const isOnboardSent = (p: Partner) => p.agent_status === "approved";

  const openOnboard = (p: Partner) => {
    setOnboardPartner(p);
    // If onboarding already sent, default to "general" type
    const defaultType = isOnboardSent(p) ? "general" : "onboard";
    resetOnboardForm(defaultType);
    // Auto-fill password if partner has account but onboarding not sent yet
    if (p.agent_user_id && !isOnboardSent(p)) {
      setOnboardPassword(generatePassword());
    }
    setOnboardOpen(true);
  };

  const handleOnboard = async () => {
    if (!onboardPartner) return;
    if (onboardEmailType === "offer" && !onboardOfferId) return;
    if ((onboardEmailType === "proposal" || onboardEmailType === "question") && !onboardCustomMsg.trim()) return;

    setOnboarding(true);
    const { data: { session } } = await supabase.auth.getSession();
    try {
      const payload: Record<string, string | undefined> = {
        partner_id: onboardPartner.id,
        email_type: onboardEmailType,
      };
      if (onboardProjectId) payload.project_id = onboardProjectId;
      if (onboardOfferId) payload.offer_id = onboardOfferId;
      if (onboardCustomMsg.trim()) payload.custom_message = onboardCustomMsg.trim();
      // Handle agent account: create if missing, reset password if existing
      let finalPassword = onboardPassword;
      if (onboardEmailType === "onboard") {
        const loginEmail = onboardPartner.login_email || onboardPartner.email;
        if (!loginEmail) {
          toast({ title: "Błąd", description: "Partner nie ma przypisanego loginu ani emaila.", variant: "destructive" });
          setOnboarding(false);
          return;
        }
        if (!finalPassword) {
          finalPassword = generatePassword();
        }

        if (!onboardPartner.agent_user_id) {
          // No account — create one
          try {
            const agentRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-agent`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}`, "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
              body: JSON.stringify({
                action: "create",
                partner_id: onboardPartner.id,
                partner_name: onboardPartner.name,
                email: loginEmail,
                password: finalPassword,
              }),
            });
            const agentResult = await agentRes.json();
            if (!agentRes.ok || agentResult.error) {
              toast({ title: "Błąd tworzenia konta", description: agentResult.error, variant: "destructive" });
              setOnboarding(false);
              return;
            }
          } catch {
            toast({ title: "Błąd tworzenia konta agenta", variant: "destructive" });
            setOnboarding(false);
            return;
          }
        } else {
          // Account exists — reset password so we can send it in the email
          try {
            const resetRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-agent`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}`, "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
              body: JSON.stringify({
                action: "reset_password",
                user_id: onboardPartner.agent_user_id,
                password: finalPassword,
              }),
            });
            const resetResult = await resetRes.json();
            if (!resetRes.ok || resetResult.error) {
              toast({ title: "Błąd resetu hasła", description: resetResult.error, variant: "destructive" });
              setOnboarding(false);
              return;
            }
          } catch {
            toast({ title: "Błąd resetu hasła agenta", variant: "destructive" });
            setOnboarding(false);
            return;
          }
        }
      }

      const loginEmailForMail = onboardPartner.login_email || onboardPartner.email;
      if (onboardEmailType === "onboard" && loginEmailForMail) {
        payload.login_email = loginEmailForMail;
        if (finalPassword) payload.login_password = finalPassword;
      }

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/trigger-onboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}`, "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok || result.error) toast({ title: "Błąd", description: result.error, variant: "destructive" });
      else {
        toast({ title: emailTypeSuccessLabels[onboardEmailType], description: `Email do ${onboardPartner.name} na ${result.email}` });
        setOnboardOpen(false);
        fetchPartners();
      }
    } catch { toast({ title: "Błąd wysyłki", variant: "destructive" }); }
    setOnboarding(false);
  };

  const statusBadge = (p: Partner) => {
    const s = p.agent_status || "new";
    const config: Record<string, { label: string; cls: string }> = {
      new: { label: "Nowy", cls: "bg-blue-100 text-blue-800 border-blue-200" },
      approved: { label: "Zatwierdzony", cls: "bg-green-100 text-green-800 border-green-200" },
      contacted: { label: "Skontaktowany", cls: "bg-yellow-100 text-yellow-800 border-yellow-200" },
    };
    const c = config[s] || config.new;
    return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${c.cls}`}>{c.label}</span>;
  };

  return (
    <AppShell>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Partnerzy</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Zarządzaj firmami partnerskimi i agentami</p>
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
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Firma</TableHead>
                      <TableHead>Kontakt</TableHead>
                      <TableHead className="text-center">Linki</TableHead>
                      <TableHead className="text-center">Status agenta</TableHead>
                      <TableHead className="text-center">Clay</TableHead>
                      {isAdmin && <TableHead className="text-right">Akcje</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {partners.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {p.name}
                            {p.parent_partner_id && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-purple-200 bg-purple-50 text-purple-700">Sub</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm space-y-0.5">
                            {p.contact_person && <div className="text-foreground">{p.contact_person}</div>}
                            {p.email && <a href={`mailto:${p.email}`} className="flex items-center gap-1 text-primary hover:underline text-xs"><Mail className="h-3 w-3" />{p.email}</a>}
                            {p.phone && <a href={`tel:${p.phone}`} className="flex items-center gap-1 text-xs hover:underline"><Phone className="h-3 w-3" />{p.phone}</a>}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="inline-flex items-center gap-1 text-sm"><Link2 className="h-3.5 w-3.5 text-muted-foreground" />{p.link_count ?? 0}</span>
                        </TableCell>
                        <TableCell className="text-center">{statusBadge(p)}</TableCell>
                        <TableCell className="text-center">
                          {p.clay_enriched_at ? (
                            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setClayDetail(p)}>
                              <Sparkles className="h-3 w-3 text-amber-500" /> Dane
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        {isAdmin && (
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleEnrich(p)} disabled={enrichingId === p.id} title="Wzbogać dane (Clay + AI)">
                                <Sparkles className={`h-3.5 w-3.5 ${enrichingId === p.id ? "animate-spin" : ""}`} />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openOnboard(p)} title="Jeden Guzik — onboard agenta">
                                <Rocket className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                              <Button variant="ghost" size="sm" onClick={() => toggleActive(p)} className="h-8 px-2 text-xs">{p.is_active ? "Off" : "On"}</Button>
                              <Button variant="ghost" size="sm" onClick={() => setDeletePartner(p)} className="h-8 w-8 p-0 text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
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

        {/* Create/Edit Dialog */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{editing ? "Edytuj partnera" : "Dodaj partnera"}</DialogTitle></DialogHeader>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2"><Label>Nazwa firmy *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
              <div className="space-y-2"><Label>Osoba kontaktowa</Label><Input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Email kontaktowy</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div className="space-y-2"><Label>Telefon</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              </div>
              {!editing && (
                <div className="space-y-2">
                  <Label>Login do panelu (email) *</Label>
                  <Input type="email" value={form.login_email} onChange={(e) => setForm({ ...form, login_email: e.target.value })} required placeholder="agent@firma.pl" />
                  <p className="text-xs text-muted-foreground">Osobny email logowania — może być inny niż email kontaktowy. Musi być unikalny dla każdego partnera.</p>
                </div>
              )}
              {!editing && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> Hasło do panelu *</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      required
                      placeholder="Min. 6 znaków"
                      minLength={6}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Login i hasło zostaną wysłane w mailu onboardingowym.</p>
                </div>
              )}
              <div className="space-y-2"><Label>Notatki</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} /></div>
              {allOffers.length > 0 && (
                <div className="space-y-2">
                  <Label>Przypisane oferty</Label>
                  <div className="max-h-40 overflow-y-auto rounded-md border border-input p-2 space-y-1">
                    {allOffers.map((o) => (
                      <label key={o.id} className="flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 hover:bg-muted text-sm">
                        <Checkbox checked={selectedOfferIds.includes(o.id)} onCheckedChange={() => toggleOffer(o.id)} />
                        <span>{o.name}</span>{o.city && <span className="text-xs text-muted-foreground">• {o.city}</span>}
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Anuluj</Button>
                <Button type="submit" disabled={saving}>{saving ? "Zapisywanie..." : "Zapisz"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Clay Detail Dialog */}
        <Dialog open={!!clayDetail} onOpenChange={(o) => !o && setClayDetail(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Dane Clay — {clayDetail?.name}</DialogTitle></DialogHeader>
            {clayDetail && (
              <div className="space-y-4">
                {clayDetail.clay_icebreaker && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">🧊 Lodołamacz (do telefonu)</Label>
                    <p className="text-sm bg-muted p-3 rounded-lg italic">"{clayDetail.clay_icebreaker}"</p>
                  </div>
                )}
                {clayDetail.clay_summary && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">📋 Notatka AI</Label>
                    <p className="text-sm bg-muted p-3 rounded-lg">{clayDetail.clay_summary}</p>
                  </div>
                )}
                {clayDetail.linkedin_url && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">LinkedIn:</span>
                    <a href={clayDetail.linkedin_url} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate">{clayDetail.linkedin_url}</a>
                  </div>
                )}
                {clayDetail.instagram_url && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Instagram:</span>
                    <a href={clayDetail.instagram_url} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate">{clayDetail.instagram_url}</a>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Wzbogacono: {new Date(clayDetail.clay_enriched_at!).toLocaleString("pl-PL")}</p>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Quick Email Dialog */}
        <Dialog open={onboardOpen} onOpenChange={setOnboardOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>📧 Wyślij email — {onboardPartner?.name}</DialogTitle>
              <DialogDescription>
                Kliknij typ wiadomości poniżej — wtedy pokażą się właściwe pola, nie tylko projekt.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Typ wiadomości *</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {emailTypeOptions.map((option) => {
                    const isDisabled = option.value === "onboard" && onboardPartner && isOnboardSent(onboardPartner);
                    return (
                      <Button
                        key={option.value}
                        type="button"
                        variant={onboardEmailType === option.value ? "default" : "outline"}
                        onClick={() => !isDisabled && resetOnboardForm(option.value)}
                        disabled={!!isDisabled}
                        className="h-auto min-h-16 justify-start whitespace-normal px-3 py-3 text-left"
                      >
                        <span className="mr-2 text-base" aria-hidden="true">{option.icon}</span>
                        <span className="flex flex-col items-start leading-tight">
                          <span>{option.label}</span>
                          <span className="text-xs opacity-80">
                            {isDisabled ? "już wysłany ✓" : option.description}
                          </span>
                        </span>
                      </Button>
                    );
                  })}
                </div>
              </div>

              {onboardEmailType === "onboard" && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Projekt inwestycyjny (opcjonalnie)</Label>
                    <Select value={onboardProjectId} onValueChange={setOnboardProjectId}>
                      <SelectTrigger><SelectValue placeholder="Bez projektu" /></SelectTrigger>
                      <SelectContent>
                        {projects.map((pr) => (
                          <SelectItem key={pr.id} value={pr.id}>{pr.name} ({pr.cities.join(", ")})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> Hasło do panelu (opcjonalne)</Label>
                    <Input
                      type="text"
                      value={onboardPassword}
                      onChange={(e) => setOnboardPassword(e.target.value)}
                      placeholder="Zostaw puste — wygeneruje się automatycznie"
                    />
                    <p className="text-xs text-muted-foreground">Login = {onboardPartner?.login_email || onboardPartner?.email || "brak emaila"}. Login i hasło zostaną automatycznie wysłane w mailu powitalnym.</p>
                  </div>
                </div>
              )}

              {onboardEmailType === "offer" && (
                <div className="space-y-2">
                  <Label>Oferta *</Label>
                  <Select value={onboardOfferId} onValueChange={setOnboardOfferId}>
                    <SelectTrigger><SelectValue placeholder="Wybierz ofertę..." /></SelectTrigger>
                    <SelectContent>
                      {allOffers.map((o) => (
                        <SelectItem key={o.id} value={o.id}>{o.name}{o.city ? ` (${o.city})` : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Wyśle szczegóły oferty i link afiliacyjny partnera.</p>
                </div>
              )}

              {onboardEmailType === "general" && (
                <p className="text-sm text-muted-foreground">
                  Wyśle podziękowanie za współpracę z podsumowaniem ofert, projektów i linków afiliacyjnych.
                </p>
              )}

              {(onboardEmailType === "follow_up" || onboardEmailType === "proposal" || onboardEmailType === "question") && (
                <div className="space-y-2">
                  <Label>{onboardEmailType === "follow_up" ? "Treść (opcjonalnie)" : "Treść *"}</Label>
                  <Textarea
                    value={onboardCustomMsg}
                    onChange={(e) => setOnboardCustomMsg(e.target.value)}
                    placeholder={
                      onboardEmailType === "follow_up" ? "Dodatkowa treść follow-upa..." :
                      onboardEmailType === "proposal" ? "Opisz propozycję..." :
                      "Napisz pytanie..."
                    }
                    rows={4}
                  />
                </div>
              )}

              <div className="rounded-md bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">
                  📬 Email zostanie wysłany na: <strong>{onboardPartner?.email || "brak emaila!"}</strong>
                </p>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setOnboardOpen(false)}>Anuluj</Button>
                <Button
                  onClick={handleOnboard}
                  disabled={
                    onboarding ||
                    !onboardPartner?.email ||
                    (onboardEmailType === "offer" && !onboardOfferId) ||
                    ((onboardEmailType === "proposal" || onboardEmailType === "question") && !onboardCustomMsg.trim())
                  }
                  className="gap-1.5"
                >
                  <Mail className="h-4 w-4" />
                  {onboarding ? "Wysyłanie..." : "Wyślij email"}
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete confirmation */}
        <AlertDialog open={!!deletePartner} onOpenChange={(o) => !o && setDeletePartner(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Usuń partnera</AlertDialogTitle>
              <AlertDialogDescription>Czy na pewno chcesz usunąć partnera <strong>{deletePartner?.name}</strong>? Operacja jest nieodwracalna.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Anuluj</AlertDialogCancel>
              <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={handleDeletePartner}>Usuń</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppShell>
  );
}
