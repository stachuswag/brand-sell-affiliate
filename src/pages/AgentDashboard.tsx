import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Link2,
  UserCheck,
  Building2,
  Phone,
  Plus,
  Copy,
  Check,
  ExternalLink,
  FileText,
  Trash2,
  Users,
  Download,
  Search,
  ShieldCheck,
  AlertTriangle,
  Briefcase,
  FolderOpen,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { pl } from "date-fns/locale";

interface AffiliateLink {
  id: string;
  tracking_code: string;
  link_type: string;
  property_name: string | null;
  is_active: boolean;
  created_at: string;
  project_id: string | null;
  projects?: { name: string; cities: string[] } | null;
}

interface Contact {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  message: string | null;
  status: string;
  created_at: string;
  affiliate_link_id: string | null;
  affiliate_links?: { tracking_code: string; property_name: string | null; project_id: string | null } | null;
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  cities: string[];
  materials_folder_url: string | null;
}

interface SubPartner {
  id: string;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
}

interface PartnerFile {
  id: string;
  subject: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  file_type: string | null;
  created_at: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  new: { label: "Nowy", className: "bg-blue-50 text-blue-700 border-blue-200" },
  in_progress: { label: "W toku", className: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  deal_closed: { label: "Zamknięty", className: "bg-green-50 text-green-700 border-green-200" },
  no_deal: { label: "Brak transakcji", className: "bg-muted text-muted-foreground border-border" },
};

function generateCode(partnerName: string, suffix?: string): string {
  const prefix = partnerName.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return suffix ? `${prefix}-${rand}-${suffix}` : `${prefix}-${rand}`;
}

export default function AgentDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [partnerName, setPartnerName] = useState<string>("");
  const [links, setLinks] = useState<AffiliateLink[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  // Add contact dialog
  const [contactOpen, setContactOpen] = useState(false);
  const [contactForm, setContactForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    message: "",
    link_id: "",
    project_id: "",
  });
  const [savingContact, setSavingContact] = useState(false);

  // Sub-partners
  const [subPartners, setSubPartners] = useState<SubPartner[]>([]);
  const [subPartnerOpen, setSubPartnerOpen] = useState(false);
  const [subPartnerForm, setSubPartnerForm] = useState({ name: "", contact_person: "", email: "", phone: "" });
  const [savingSubPartner, setSavingSubPartner] = useState(false);

  // Partner files
  const [partnerFiles, setPartnerFiles] = useState<PartnerFile[]>([]);

  // Delete contact
  const [deleteContact, setDeleteContact] = useState<Contact | null>(null);

  // Soft check state
  const [softCheckStep, setSoftCheckStep] = useState<"check" | "form">("check");
  const [softCheckName, setSoftCheckName] = useState("");
  const [softCheckPhone, setSoftCheckPhone] = useState("");
  const [softCheckLoading, setSoftCheckLoading] = useState(false);
  const [softCheckResult, setSoftCheckResult] = useState<"ok" | "duplicate" | null>(null);

  // RODO consent
  const [rodoConsent, setRodoConsent] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadAgentData();
  }, [user]);

  const loadAgentData = async () => {
    if (!user) return;
    setLoading(true);

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("partner_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!roleData?.partner_id) {
      setLoading(false);
      return;
    }

    const pid = roleData.partner_id;
    setPartnerId(pid);

    const { data: partnerData } = await supabase
      .from("partners")
      .select("name")
      .eq("id", pid)
      .maybeSingle();

    if (partnerData) setPartnerName(partnerData.name);

    // Load links (with project info)
    const { data: linksData } = await supabase
      .from("affiliate_links")
      .select("*, projects(name, cities)")
      .eq("partner_id", pid)
      .order("created_at", { ascending: false });

    if (linksData) setLinks(linksData as unknown as AffiliateLink[]);

    // Load contacts through this partner's links
    const linkIds = (linksData ?? []).map((l) => l.id);
    if (linkIds.length > 0) {
      const { data: contactsData } = await supabase
        .from("contacts")
        .select("*, affiliate_links(tracking_code, property_name, project_id)")
        .in("affiliate_link_id", linkIds)
        .order("created_at", { ascending: false });

      if (contactsData) setContacts(contactsData as unknown as Contact[]);
    }

    // Load assigned projects
    const { data: assignedProjectIds } = await supabase
      .from("partner_projects")
      .select("project_id")
      .eq("partner_id", pid);

    const projectIds = assignedProjectIds?.map((r) => r.project_id) ?? [];
    if (projectIds.length > 0) {
      const { data: projectsData } = await supabase
        .from("projects")
        .select("id, name, description, cities, materials_folder_url")
        .in("id", projectIds)
        .eq("is_active", true)
        .order("name");
      if (projectsData) setProjects(projectsData as Project[]);
    } else {
      setProjects([]);
    }

    // Load sub-partners
    const { data: subData } = await supabase
      .from("partners")
      .select("id, name, contact_person, email, phone, created_at")
      .eq("parent_partner_id", pid)
      .order("created_at", { ascending: false });

    setSubPartners((subData ?? []) as SubPartner[]);

    // Load partner files
    const { data: filesData } = await supabase
      .from("partner_files")
      .select("id, subject, file_name, file_url, file_size, file_type, created_at")
      .eq("partner_id", pid)
      .order("created_at", { ascending: false });

    setPartnerFiles((filesData ?? []) as PartnerFile[]);

    setLoading(false);
  };

  const buildTrackingUrl = (code: string) => `${window.location.origin}/c/${code}`;

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(buildTrackingUrl(code));
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
    toast({ title: "Link skopiowany!" });
  };

  // Get/create a project-specific link for this partner
  const getOrCreateProjectLink = async (projectId: string): Promise<string | null> => {
    if (!partnerId) return null;
    const existing = links.find((l) => l.project_id === projectId);
    if (existing) return existing.id;

    const project = projects.find((p) => p.id === projectId);
    const code = generateCode(partnerName);
    const { data: newLink, error } = await supabase
      .from("affiliate_links")
      .insert({
        partner_id: partnerId,
        project_id: projectId,
        tracking_code: code,
        link_type: "partner" as const,
        property_name: project?.name ?? null,
        property_address: project?.cities?.join(", ") ?? null,
      })
      .select("id")
      .single();

    if (error) {
      toast({ title: "Błąd tworzenia linku", description: error.message, variant: "destructive" });
      return null;
    }
    return newLink?.id ?? null;
  };

  const openLeadForProject = (projectId: string) => {
    setContactForm({ full_name: "", email: "", phone: "", message: "", link_id: "", project_id: projectId });
    setSoftCheckStep("check");
    setSoftCheckName("");
    setSoftCheckPhone("");
    setSoftCheckResult(null);
    setRodoConsent(false);
    setContactOpen(true);
  };

  const handleSoftCheck = async () => {
    if (!softCheckName.trim() || softCheckPhone.trim().length < 4) {
      toast({ title: "Uzupełnij dane", description: "Podaj imię i 4 ostatnie cyfry telefonu.", variant: "destructive" });
      return;
    }
    setSoftCheckLoading(true);
    const last4 = softCheckPhone.trim().slice(-4);

    const { data: existing } = await supabase
      .from("contacts")
      .select("id, full_name, phone")
      .ilike("full_name", `%${softCheckName.trim()}%`)
      .like("phone", `%${last4}`);

    setSoftCheckLoading(false);

    if (existing && existing.length > 0) {
      setSoftCheckResult("duplicate");
    } else {
      setSoftCheckResult("ok");
      setSoftCheckStep("form");
      setContactForm({ ...contactForm, full_name: softCheckName.trim(), phone: "" });
    }
  };

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactForm.full_name || !partnerId || !rodoConsent) return;
    setSavingContact(true);

    // Determine link: project-specific > selected > first > new manual
    let linkId: string | null = contactForm.link_id || null;

    if (!linkId && contactForm.project_id) {
      linkId = await getOrCreateProjectLink(contactForm.project_id);
    }

    if (!linkId) linkId = links[0]?.id ?? null;

    if (!linkId) {
      // Create a manual link as last resort
      const code = generateCode(partnerName, "MAN");
      const { data: newLink, error: linkErr } = await supabase
        .from("affiliate_links")
        .insert({
          partner_id: partnerId,
          tracking_code: code,
          link_type: "partner" as const,
          property_name: "Kontakt ręczny",
        })
        .select("id")
        .single();

      if (linkErr || !newLink) {
        toast({ title: "Błąd", description: linkErr?.message ?? "Nie udało się utworzyć linku", variant: "destructive" });
        setSavingContact(false);
        return;
      }
      linkId = newLink.id;
    }

    const { error } = await supabase.from("contacts").insert({
      full_name: contactForm.full_name,
      email: contactForm.email || null,
      phone: contactForm.phone || null,
      message: contactForm.message || null,
      affiliate_link_id: linkId,
      status: "new" as const,
    });

    if (error) {
      toast({ title: "Błąd", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Klient dodany!", description: "Powiadomienie wysłane do admina." });
      supabase.functions.invoke("notify-sms", {
        body: {
          full_name: contactForm.full_name,
          email: contactForm.email,
          phone: contactForm.phone,
          source: "rejestracja_manualna",
          partner_name: partnerName || "",
          partner_id: partnerId || "",
        },
      }).catch(() => {});
      setContactOpen(false);
      setContactForm({ full_name: "", email: "", phone: "", message: "", link_id: "", project_id: "" });
      loadAgentData();
    }
    setSavingContact(false);
  };

  const handleDeleteContact = async () => {
    if (!deleteContact) return;
    const { error } = await supabase.from("contacts").delete().eq("id", deleteContact.id);
    if (error) {
      toast({ title: "Błąd", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Klient usunięty" });
      loadAgentData();
    }
    setDeleteContact(null);
  };

  const handleAddSubPartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subPartnerForm.name.trim() || !partnerId) return;
    setSavingSubPartner(true);

    const { error } = await supabase.from("partners").insert({
      name: subPartnerForm.name,
      contact_person: subPartnerForm.contact_person || null,
      email: subPartnerForm.email || null,
      phone: subPartnerForm.phone || null,
      parent_partner_id: partnerId,
    });

    if (error) {
      toast({ title: "Błąd", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Sub-partner dodany!" });
      setSubPartnerOpen(false);
      setSubPartnerForm({ name: "", contact_person: "", email: "", phone: "" });
      loadAgentData();
    }
    setSavingSubPartner(false);
  };

  // Helpers for project section
  const linksForProject = (pid: string) => links.filter((l) => l.project_id === pid);
  const leadsCountForProject = (pid: string) =>
    contacts.filter((c) => c.affiliate_links?.project_id === pid).length;

  if (loading) {
    return (
      <AppShell>
        <div className="flex h-full items-center justify-center p-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </AppShell>
    );
  }

  if (!partnerId) {
    return (
      <AppShell>
        <div className="p-8 text-center text-muted-foreground">
          <p>Twoje konto nie jest powiązane z żadnym partnerem. Skontaktuj się z administratorem.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Panel agenta</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{partnerName}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Briefcase className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{projects.length}</p>
                <p className="text-xs text-muted-foreground">Projekty</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Link2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{links.length}</p>
                <p className="text-xs text-muted-foreground">Linki</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-accent/20 flex items-center justify-center">
                <UserCheck className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{contacts.length}</p>
                <p className="text-xs text-muted-foreground">Kontakty</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-success/20 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {contacts.filter((c) => c.status === "deal_closed").length}
                </p>
                <p className="text-xs text-muted-foreground">Zamknięte</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="projects">
          <TabsList className="flex-wrap">
            <TabsTrigger value="projects">Moje projekty ({projects.length})</TabsTrigger>
            <TabsTrigger value="links">Wszystkie linki ({links.length})</TabsTrigger>
            <TabsTrigger value="contacts">Klienci ({contacts.length})</TabsTrigger>
            <TabsTrigger value="files">Pliki ({partnerFiles.length})</TabsTrigger>
            <TabsTrigger value="sub-partners">Moi partnerzy ({subPartners.length})</TabsTrigger>
          </TabsList>

          {/* PROJECTS TAB - main view */}
          <TabsContent value="projects" className="space-y-4">
            {projects.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Briefcase className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Brak przypisanych projektów inwestycyjnych. Skontaktuj się z administratorem.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {projects.map((p) => {
                  const projLinks = linksForProject(p.id);
                  const leads = leadsCountForProject(p.id);
                  return (
                    <Card key={p.id} className="overflow-hidden">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <CardTitle className="text-base font-semibold">{p.name}</CardTitle>
                            {p.cities?.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {p.cities.map((c) => (
                                  <Badge key={c} variant="outline" className="text-xs">{c}</Badge>
                                ))}
                              </div>
                            )}
                          </div>
                          <Badge variant="outline" className="text-xs bg-accent/10 text-accent border-accent/30 shrink-0">
                            {leads} {leads === 1 ? "lead" : "leadów"}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {p.description && (
                          <p className="text-xs text-muted-foreground">{p.description}</p>
                        )}

                        {p.materials_folder_url && (
                          <a
                            href={p.materials_folder_url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-2 text-xs text-primary hover:underline"
                          >
                            <FolderOpen className="h-3.5 w-3.5" />
                            Folder z materiałami
                          </a>
                        )}

                        {/* Affiliate links for this project */}
                        <div className="space-y-1.5">
                          <p className="text-xs font-semibold text-foreground">Linki afiliacyjne</p>
                          {projLinks.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic">Brak — kliknij "Zarejestruj leada", link utworzy się automatycznie.</p>
                          ) : (
                            projLinks.map((l) => (
                              <div key={l.id} className="flex items-center gap-2 rounded-md border bg-muted/40 p-2">
                                <code className="flex-1 truncate text-xs font-mono text-foreground">
                                  {buildTrackingUrl(l.tracking_code)}
                                </code>
                                <Button variant="ghost" size="sm" onClick={() => handleCopy(l.tracking_code)} className="h-7 w-7 p-0 shrink-0">
                                  {copied === l.tracking_code ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => window.open(buildTrackingUrl(l.tracking_code), "_blank")} className="h-7 w-7 p-0 shrink-0">
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            ))
                          )}
                        </div>

                        <Button
                          onClick={() => openLeadForProject(p.id)}
                          className="w-full gap-2"
                          size="sm"
                        >
                          <Plus className="h-4 w-4" /> Zarejestruj leada dla tego projektu
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* LINKS TAB */}
          <TabsContent value="links" className="space-y-4">
            <Card>
              <CardContent className="p-0">
                {links.length === 0 ? (
                  <div className="p-12 text-center">
                    <Link2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">Brak linków. Linki tworzą się automatycznie dla każdego przypisanego projektu.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Kod</TableHead>
                          <TableHead>Projekt</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Utworzono</TableHead>
                          <TableHead className="text-right">Akcje</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {links.map((l) => (
                          <TableRow key={l.id}>
                            <TableCell>
                              <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                                {l.tracking_code}
                              </code>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {l.projects?.name ?? l.property_name ?? <span className="italic text-xs">Ogólny</span>}
                            </TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${l.is_active ? "bg-green-50 text-green-700 border-green-200" : "bg-muted text-muted-foreground border-border"}`}>
                                {l.is_active ? "Aktywny" : "Nieaktywny"}
                              </span>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {format(new Date(l.created_at), "d MMM yyyy", { locale: pl })}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="sm" onClick={() => handleCopy(l.tracking_code)} className="h-8 w-8 p-0" title="Kopiuj link">
                                  {copied === l.tracking_code ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => window.open(buildTrackingUrl(l.tracking_code), "_blank")} className="h-8 w-8 p-0" title="Otwórz">
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </Button>
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
          </TabsContent>

          {/* CONTACTS TAB */}
          <TabsContent value="contacts" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => openLeadForProject("")} className="gap-2">
                <Plus className="h-4 w-4" /> Dodaj klienta
              </Button>
            </div>
            <Card>
              <CardContent className="p-0">
                {contacts.length === 0 ? (
                  <div className="p-12 text-center">
                    <UserCheck className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">Brak klientów. Dodaj pierwszego klienta ręcznie.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                         <TableRow>
                          <TableHead>Klient</TableHead>
                          <TableHead>Kontakt</TableHead>
                          <TableHead>Link</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead className="text-right">Akcje</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {contacts.map((c) => {
                          const sc = statusConfig[c.status] ?? statusConfig.new;
                          return (
                            <TableRow key={c.id}>
                              <TableCell className="font-medium">{c.full_name}</TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-0.5">
                                  {c.email && <span className="text-xs text-muted-foreground">{c.email}</span>}
                                  {c.phone && (
                                    <a href={`tel:${c.phone}`} className="flex items-center gap-1 text-xs text-primary hover:underline">
                                      <Phone className="h-3 w-3" />{c.phone}
                                    </a>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                <div className="flex items-center gap-1.5">
                                  {c.affiliate_links?.tracking_code?.endsWith("-MAN") && (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-orange-200 bg-orange-50 text-orange-700">Ręcznie</Badge>
                                  )}
                                  {c.affiliate_links?.property_name ?? c.affiliate_links?.tracking_code ?? "—"}
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${sc.className}`}>
                                  {sc.label}
                                </span>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {format(new Date(c.created_at), "d MMM yyyy", { locale: pl })}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setDeleteContact(c)}
                                  className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  title="Usuń klienta"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
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
          </TabsContent>

          {/* FILES TAB */}
          <TabsContent value="files" className="space-y-4">
            <Card>
              <CardContent className="p-0">
                {partnerFiles.length === 0 ? (
                  <div className="p-12 text-center">
                    <Download className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">Brak plików do pobrania.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Temat</TableHead>
                          <TableHead>Plik</TableHead>
                          <TableHead>Rozmiar</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead className="text-right">Pobierz</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {partnerFiles.map((f) => (
                          <TableRow key={f.id}>
                            <TableCell className="font-medium text-sm">{f.subject}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                                <span className="text-sm truncate max-w-[200px]">{f.file_name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {f.file_size ? (f.file_size < 1024 * 1024 ? `${(f.file_size / 1024).toFixed(1)} KB` : `${(f.file_size / (1024 * 1024)).toFixed(1)} MB`) : "—"}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {format(new Date(f.created_at), "d MMM yyyy, HH:mm", { locale: pl })}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1.5 h-8 text-xs"
                                onClick={async () => {
                                  const path = decodeURIComponent(f.file_url.split("/partner-files/")[1] ?? "");
                                  if (!path) {
                                    toast({ title: "Błąd pobierania", description: "Nie udało się odczytać ścieżki pliku.", variant: "destructive" });
                                    return;
                                  }
                                  const { data, error } = await supabase.storage.from("partner-files").download(path);
                                  if (error || !data) {
                                    toast({ title: "Błąd pobierania", description: "Nie udało się pobrać pliku.", variant: "destructive" });
                                    return;
                                  }
                                  const downloadUrl = window.URL.createObjectURL(data);
                                  const link = document.createElement("a");
                                  link.href = downloadUrl;
                                  link.download = f.file_name;
                                  document.body.appendChild(link);
                                  link.click();
                                  setTimeout(() => { link.remove(); window.URL.revokeObjectURL(downloadUrl); }, 1000);
                                }}
                              >
                                <Download className="h-3.5 w-3.5" /> Pobierz
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sub-partners" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setSubPartnerOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" /> Dodaj partnera
              </Button>
            </div>
            <Card>
              <CardContent className="p-0">
                {subPartners.length === 0 ? (
                  <div className="p-12 text-center">
                    <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">Brak sub-partnerów. Dodaj swojego pierwszego partnera.</p>
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
                          <TableHead>Dodano</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {subPartners.map((sp) => (
                          <TableRow key={sp.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                {sp.name}
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-purple-200 bg-purple-50 text-purple-700">
                                  Sub-partner {partnerName}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{sp.contact_person ?? "—"}</TableCell>
                            <TableCell className="text-sm">{sp.email ?? "—"}</TableCell>
                            <TableCell className="text-sm">{sp.phone ?? "—"}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {format(new Date(sp.created_at), "d MMM yyyy", { locale: pl })}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Add Contact Dialog */}
        <Dialog open={contactOpen} onOpenChange={(open) => {
          setContactOpen(open);
          if (!open) {
            setSoftCheckStep("check");
            setSoftCheckName("");
            setSoftCheckPhone("");
            setSoftCheckResult(null);
            setRodoConsent(false);
            setContactForm({ full_name: "", email: "", phone: "", message: "", link_id: "", project_id: "" });
          }
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {softCheckStep === "check" ? "Weryfikacja klienta" : "Dodaj klienta ręcznie"}
              </DialogTitle>
            </DialogHeader>

            {softCheckStep === "check" ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Sprawdź czy klient nie jest już w bazie. Podaj imię i 4 ostatnie cyfry telefonu.
                </p>
                <div className="space-y-2">
                  <Label>Imię klienta *</Label>
                  <Input
                    value={softCheckName}
                    onChange={(e) => { setSoftCheckName(e.target.value); setSoftCheckResult(null); }}
                    placeholder="Jan"
                  />
                </div>
                <div className="space-y-2">
                  <Label>4 ostatnie cyfry telefonu *</Label>
                  <Input
                    value={softCheckPhone}
                    onChange={(e) => { setSoftCheckPhone(e.target.value.replace(/\D/g, "").slice(0, 4)); setSoftCheckResult(null); }}
                    placeholder="1234"
                    maxLength={4}
                  />
                </div>

                {softCheckResult === "duplicate" && (
                  <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
                    <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-destructive text-sm">Klient już istnieje w bazie!</p>
                      <p className="text-xs text-muted-foreground mt-1">Nie możesz zarejestrować tego klienta ponownie.</p>
                    </div>
                  </div>
                )}

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setContactOpen(false)}>Anuluj</Button>
                  <Button
                    onClick={handleSoftCheck}
                    disabled={softCheckLoading || softCheckName.trim().length === 0 || softCheckPhone.length < 4}
                    className="gap-2"
                  >
                    {softCheckLoading ? "Sprawdzanie..." : <><Search className="h-4 w-4" /> Sprawdź</>}
                  </Button>
                </DialogFooter>
              </div>
            ) : (
              <form onSubmit={handleAddContact} className="space-y-4">
                <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-3 dark:bg-green-950/20 dark:border-green-800">
                  <ShieldCheck className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                  <p className="text-sm text-green-700 dark:text-green-400">Klient zweryfikowany — nie znaleziono w bazie.</p>
                </div>

                {contactForm.project_id && (
                  <div className="rounded-md bg-muted/50 p-2 text-xs">
                    Projekt: <strong>{projects.find((p) => p.id === contactForm.project_id)?.name}</strong>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Imię i nazwisko *</Label>
                  <Input
                    value={contactForm.full_name}
                    onChange={(e) => setContactForm({ ...contactForm, full_name: e.target.value })}
                    placeholder="Jan Kowalski"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={contactForm.email}
                      onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                      placeholder="jan@email.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefon</Label>
                    <Input
                      value={contactForm.phone}
                      onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                      placeholder="+48 500 000 000"
                    />
                  </div>
                </div>

                {!contactForm.project_id && projects.length > 0 && (
                  <div className="space-y-2">
                    <Label>Projekt (opcjonalnie)</Label>
                    <Select
                      value={contactForm.project_id || "none"}
                      onValueChange={(v) => setContactForm({ ...contactForm, project_id: v === "none" ? "" : v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Wybierz projekt..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Bez projektu —</SelectItem>
                        {projects.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Wiadomość / Notatka</Label>
                  <Textarea
                    value={contactForm.message}
                    onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                    placeholder="Notatka o kliencie..."
                    rows={3}
                  />
                </div>

                <div className="flex items-start gap-3 rounded-lg border p-3">
                  <Checkbox
                    id="rodo-consent"
                    checked={rodoConsent}
                    onCheckedChange={(checked) => setRodoConsent(checked === true)}
                    className="mt-0.5"
                  />
                  <label htmlFor="rodo-consent" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                    Oświadczam, że posiadam zgodę klienta na przekazanie jego danych osobowych w celu kontaktu handlowego (RODO). *
                  </label>
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setSoftCheckStep("check")}>Wróć</Button>
                  <Button type="submit" disabled={savingContact || !contactForm.full_name || !rodoConsent}>
                    {savingContact ? "Dodawanie..." : "Dodaj klienta"}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>

        {/* Sub-Partner Dialog */}
        <Dialog open={subPartnerOpen} onOpenChange={setSubPartnerOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Dodaj sub-partnera</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddSubPartner} className="space-y-4">
              <div className="space-y-2">
                <Label>Nazwa firmy *</Label>
                <Input value={subPartnerForm.name} onChange={(e) => setSubPartnerForm({ ...subPartnerForm, name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Osoba kontaktowa</Label>
                <Input value={subPartnerForm.contact_person} onChange={(e) => setSubPartnerForm({ ...subPartnerForm, contact_person: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={subPartnerForm.email} onChange={(e) => setSubPartnerForm({ ...subPartnerForm, email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Telefon</Label>
                  <Input value={subPartnerForm.phone} onChange={(e) => setSubPartnerForm({ ...subPartnerForm, phone: e.target.value })} />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setSubPartnerOpen(false)}>Anuluj</Button>
                <Button type="submit" disabled={savingSubPartner || !subPartnerForm.name.trim()}>
                  {savingSubPartner ? "Dodawanie..." : "Dodaj"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete contact confirmation */}
        <AlertDialog open={!!deleteContact} onOpenChange={(o) => !o && setDeleteContact(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Usuń klienta</AlertDialogTitle>
              <AlertDialogDescription>
                Czy na pewno chcesz usunąć klienta <strong>{deleteContact?.full_name}</strong>? Operacja jest nieodwracalna.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Anuluj</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleDeleteContact}
              >
                Usuń
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppShell>
  );
}
