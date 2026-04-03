import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Package,
  Trash2,
  Users,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { OfferAttachmentsDialog } from "@/components/OfferAttachmentsDialog";
import { format } from "date-fns";
import { pl } from "date-fns/locale";

interface AffiliateLink {
  id: string;
  tracking_code: string;
  link_type: string;
  property_name: string | null;
  is_active: boolean;
  created_at: string;
  offer_id: string | null;
  offers?: { name: string; city: string | null } | null;
}

interface Contact {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  message: string | null;
  status: string;
  created_at: string;
  affiliate_links?: { tracking_code: string; property_name: string | null } | null;
}

interface Offer {
  id: string;
  name: string;
  city: string | null;
  address: string | null;
  price: number | null;
  commission_type: string | null;
  commission_percent: number | null;
  commission_amount: number | null;
  submitted_by_partner_id?: string | null;
}

interface PartnerOffer {
  id: string;
  name: string;
  city: string | null;
  address: string | null;
  price: number | null;
  submitted_by_partner_id?: string | null;
}

interface SubPartner {
  id: string;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  new: { label: "Nowy", className: "bg-blue-50 text-blue-700 border-blue-200" },
  in_progress: { label: "W toku", className: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  deal_closed: { label: "Zamknięty", className: "bg-green-50 text-green-700 border-green-200" },
  no_deal: { label: "Brak transakcji", className: "bg-muted text-muted-foreground border-border" },
};

function generateCode(partnerName: string): string {
  const prefix = partnerName.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${rand}`;
}

export default function AgentDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [partnerName, setPartnerName] = useState<string>("");
  const [links, setLinks] = useState<AffiliateLink[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [partnerOffers, setPartnerOffers] = useState<PartnerOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);

  // Add contact dialog
  const [contactOpen, setContactOpen] = useState(false);
  const [contactForm, setContactForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    message: "",
    link_id: "",
  });
  const [savingContact, setSavingContact] = useState(false);

  // Create link dialog
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkForm, setLinkForm] = useState({
    offer_id: "",
    link_type: "partner" as "partner" | "property",
    property_name: "",
  });
  const [savingLink, setSavingLink] = useState(false);

  // Add offer dialog
  const [offerOpen, setOfferOpen] = useState(false);
  const [offerForm, setOfferForm] = useState({
    name: "",
    city: "",
    address: "",
    price: "",
    description: "",
  });
  const [savingOffer, setSavingOffer] = useState(false);

  // Sub-partners
  const [subPartners, setSubPartners] = useState<SubPartner[]>([]);
  const [subPartnerOpen, setSubPartnerOpen] = useState(false);
  const [subPartnerForm, setSubPartnerForm] = useState({ name: "", contact_person: "", email: "", phone: "" });
  const [savingSubPartner, setSavingSubPartner] = useState(false);

  // Delete contact
  const [deleteContact, setDeleteContact] = useState<Contact | null>(null);

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

    // Load links
    const { data: linksData } = await supabase
      .from("affiliate_links")
      .select("*, offers(name, city)")
      .eq("partner_id", pid)
      .order("created_at", { ascending: false });

    if (linksData) setLinks(linksData as AffiliateLink[]);

    // Load contacts through this partner's links
    const linkIds = (linksData ?? []).map((l) => l.id);
    if (linkIds.length > 0) {
      const { data: contactsData } = await supabase
        .from("contacts")
        .select("*, affiliate_links(tracking_code, property_name)")
        .in("affiliate_link_id", linkIds)
        .order("created_at", { ascending: false });

      if (contactsData) setContacts(contactsData as Contact[]);
    }

    // Load offers assigned to this partner (from admin)
    const { data: assignedOfferIds } = await supabase
      .from("partner_offers")
      .select("offer_id")
      .eq("partner_id", pid);

    const offerIds = assignedOfferIds?.map((r) => r.offer_id) ?? [];

    if (offerIds.length > 0) {
      const { data: offersData } = await supabase
        .from("offers")
        .select("id, name, city, address, price, commission_type, commission_percent, commission_amount, submitted_by_partner_id")
        .in("id", offerIds)
        .eq("is_active", true)
        .order("name");
      if (offersData) setOffers(offersData as Offer[]);
    } else {
      setOffers([]);
    }

    // Load offers submitted by this partner
    const { data: myOffers } = await supabase
      .from("offers")
      .select("id, name, city, address, price, submitted_by_partner_id")
      .eq("submitted_by_partner_id", pid)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    setPartnerOffers((myOffers ?? []) as PartnerOffer[]);

    // Load sub-partners
    const { data: subData } = await supabase
      .from("partners")
      .select("id, name, contact_person, email, phone, created_at")
      .eq("parent_partner_id", pid)
      .order("created_at", { ascending: false });

    setSubPartners((subData ?? []) as SubPartner[]);

    setLoading(false);
  };

  const buildTrackingUrl = (code: string) => `${window.location.origin}/c/${code}`;

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(buildTrackingUrl(code));
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
    toast({ title: "Link skopiowany!" });
  };

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactForm.full_name || !partnerId) return;
    setSavingContact(true);

    // Use selected link or first available; if none, create a temporary "manual" link
    let linkId = contactForm.link_id || links[0]?.id || null;

    if (!linkId) {
      // Create a default link for manual contacts
      const code = generateCode(partnerName) + "-MAN";
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
      setContactOpen(false);
      setContactForm({ full_name: "", email: "", phone: "", message: "", link_id: "" });
      loadAgentData();
    }
    setSavingContact(false);
  };

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partnerId) return;
    setSavingLink(true);

    const code = generateCode(partnerName);
    const offer = offers.find((o) => o.id === linkForm.offer_id);

    const { error } = await supabase.from("affiliate_links").insert({
      partner_id: partnerId,
      tracking_code: code,
      link_type: linkForm.link_type,
      offer_id: linkForm.offer_id || null,
      property_name: offer?.name || linkForm.property_name || null,
      property_address: offer ? [offer.address, offer.city].filter(Boolean).join(", ") : null,
    });

    if (error) {
      toast({ title: "Błąd", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Link utworzony!" });
      setLinkOpen(false);
      setLinkForm({ offer_id: "", link_type: "partner", property_name: "" });
      loadAgentData();
    }
    setSavingLink(false);
  };

  const handleAddOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!offerForm.name.trim() || !partnerId) return;
    setSavingOffer(true);

    const { data: newOffer, error } = await supabase
      .from("offers")
      .insert({
        name: offerForm.name,
        city: offerForm.city || null,
        address: offerForm.address || null,
        price: offerForm.price ? parseFloat(offerForm.price) : null,
        description: offerForm.description || null,
        submitted_by_partner_id: partnerId,
        created_by: user!.id,
      })
      .select("id")
      .single();

    if (error || !newOffer) {
      toast({ title: "Błąd", description: error?.message ?? "Nie udało się dodać oferty", variant: "destructive" });
      setSavingOffer(false);
      return;
    }

    // Auto-assign to this partner
    await supabase.from("partner_offers").insert({
      partner_id: partnerId,
      offer_id: newOffer.id,
    });

    toast({ title: "Oferta dodana!", description: "Oferta została przypisana do Twojego konta." });
    setOfferOpen(false);
    setOfferForm({ name: "", city: "", address: "", price: "", description: "" });
    loadAgentData();
    setSavingOffer(false);
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

  const fmt = (n: number) =>
    new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", maximumFractionDigits: 0 }).format(n);

  const getCommission = (o: Offer) => {
    if (o.commission_type === "amount" && o.commission_amount)
      return fmt(o.commission_amount);
    if (o.commission_type === "percent" && o.commission_percent)
      return `${o.commission_percent}%`;
    return "—";
  };

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
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-orange-100 flex items-center justify-center">
                <Package className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{partnerOffers.length}</p>
                <p className="text-xs text-muted-foreground">Moje oferty</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="links">
          <TabsList>
            <TabsTrigger value="links">Moje linki ({links.length})</TabsTrigger>
            <TabsTrigger value="contacts">Klienci ({contacts.length})</TabsTrigger>
            <TabsTrigger value="offers">Oferty ({offers.length})</TabsTrigger>
            <TabsTrigger value="my-offers">Moje oferty ({partnerOffers.length})</TabsTrigger>
            <TabsTrigger value="sub-partners">Moi partnerzy ({subPartners.length})</TabsTrigger>
          </TabsList>

          {/* LINKS TAB */}
          <TabsContent value="links" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setLinkOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" /> Nowy link
              </Button>
            </div>
            <Card>
              <CardContent className="p-0">
                {links.length === 0 ? (
                  <div className="p-12 text-center">
                    <Link2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">Brak linków. Utwórz pierwszy link.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Kod</TableHead>
                          <TableHead>Typ</TableHead>
                          <TableHead>Nieruchomość</TableHead>
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
                            <TableCell>
                              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${l.link_type === "property" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-purple-50 text-purple-700 border-purple-200"}`}>
                                {l.link_type === "property" ? "Oferta" : "Ogólny"}
                              </span>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {l.property_name ?? l.offers?.name ?? "—"}
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
              <Button onClick={() => setContactOpen(true)} className="gap-2">
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

          {/* ASSIGNED OFFERS TAB */}
          <TabsContent value="offers">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {offers.map((o) => (
                <Card
                  key={o.id}
                  className="overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all"
                  onClick={() => setSelectedOffer(o)}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold">{o.name}</CardTitle>
                    {o.city && <p className="text-xs text-muted-foreground">{o.city}</p>}
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {o.address && <p className="text-xs text-muted-foreground">{o.address}</p>}
                    <div className="flex items-center justify-between">
                      {o.price && (
                        <span className="text-sm font-bold text-foreground">{fmt(o.price)}</span>
                      )}
                      <Badge variant="outline" className="text-xs bg-accent/10 text-accent border-accent/30">
                        Prowizja: {getCommission(o)}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <FileText className="h-3 w-3" /> Kliknij, aby zobaczyć pliki i linki
                    </p>
                  </CardContent>
                </Card>
              ))}
              {offers.length === 0 && (
                <div className="col-span-full p-12 text-center text-muted-foreground text-sm">
                  Brak przypisanych ofert od administratora.
                </div>
              )}
            </div>
          </TabsContent>

          {/* MY (PARTNER) OFFERS TAB */}
          <TabsContent value="my-offers" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setOfferOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" /> Dodaj ofertę
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {partnerOffers.map((o) => (
                <Card key={o.id} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base font-semibold">{o.name}</CardTitle>
                      <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">
                        Twoja oferta
                      </Badge>
                    </div>
                    {o.city && <p className="text-xs text-muted-foreground">{o.city}</p>}
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {o.address && <p className="text-xs text-muted-foreground">{o.address}</p>}
                    {o.price && (
                      <span className="text-sm font-bold text-foreground">{fmt(o.price)}</span>
                    )}
                  </CardContent>
                </Card>
              ))}
              {partnerOffers.length === 0 && (
                <div className="col-span-full p-12 text-center text-muted-foreground text-sm">
                  Nie dodałeś jeszcze żadnych ofert. Kliknij "Dodaj ofertę" aby dodać swoją pierwszą.
                </div>
              )}
            </div>
          </TabsContent>

          {/* SUB-PARTNERS TAB */}
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
        <Dialog open={contactOpen} onOpenChange={setContactOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Dodaj klienta ręcznie</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddContact} className="space-y-4">
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
              {links.length > 0 && (
                <div className="space-y-2">
                  <Label>Przypisz do linku (opcjonalnie)</Label>
                  <Select value={contactForm.link_id} onValueChange={(v) => setContactForm({ ...contactForm, link_id: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Automatycznie" />
                    </SelectTrigger>
                    <SelectContent>
                      {links.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.tracking_code}{l.property_name ? ` — ${l.property_name}` : ""}
                        </SelectItem>
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
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setContactOpen(false)}>Anuluj</Button>
                <Button type="submit" disabled={savingContact || !contactForm.full_name}>
                  {savingContact ? "Dodawanie..." : "Dodaj klienta"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Create Link Dialog */}
        <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Utwórz nowy link</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateLink} className="space-y-4">
              <div className="space-y-2">
                <Label>Typ linku</Label>
                <Select value={linkForm.link_type} onValueChange={(v) => setLinkForm({ ...linkForm, link_type: v as "partner" | "property" })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="partner">Ogólny</SelectItem>
                    <SelectItem value="property">Per oferta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {linkForm.link_type === "property" && (
                <div className="space-y-2">
                  <Label>Wybierz ofertę</Label>
                  <Select value={linkForm.offer_id} onValueChange={(v) => setLinkForm({ ...linkForm, offer_id: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Wybierz ofertę" />
                    </SelectTrigger>
                    <SelectContent>
                      {offers.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.name}{o.city ? ` • ${o.city}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setLinkOpen(false)}>Anuluj</Button>
                <Button type="submit" disabled={savingLink}>
                  {savingLink ? "Tworzenie..." : "Utwórz link"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Add Offer Dialog */}
        <Dialog open={offerOpen} onOpenChange={setOfferOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Dodaj swoją ofertę</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddOffer} className="space-y-4">
              <div className="space-y-2">
                <Label>Nazwa oferty *</Label>
                <Input
                  value={offerForm.name}
                  onChange={(e) => setOfferForm({ ...offerForm, name: e.target.value })}
                  placeholder="np. Apartament ul. Kwiatowa 5"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Miasto</Label>
                  <Input
                    value={offerForm.city}
                    onChange={(e) => setOfferForm({ ...offerForm, city: e.target.value })}
                    placeholder="Warszawa"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cena (PLN)</Label>
                  <Input
                    type="number"
                    value={offerForm.price}
                    onChange={(e) => setOfferForm({ ...offerForm, price: e.target.value })}
                    placeholder="500000"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Adres</Label>
                <Input
                  value={offerForm.address}
                  onChange={(e) => setOfferForm({ ...offerForm, address: e.target.value })}
                  placeholder="ul. Kwiatowa 5/3"
                />
              </div>
              <div className="space-y-2">
                <Label>Opis</Label>
                <Textarea
                  value={offerForm.description}
                  onChange={(e) => setOfferForm({ ...offerForm, description: e.target.value })}
                  placeholder="Opis nieruchomości..."
                  rows={3}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOfferOpen(false)}>Anuluj</Button>
                <Button type="submit" disabled={savingOffer || !offerForm.name.trim()}>
                  {savingOffer ? "Dodawanie..." : "Dodaj ofertę"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Offer attachments dialog (read-only for agents) */}
        <OfferAttachmentsDialog
          offer={selectedOffer}
          open={!!selectedOffer}
          onOpenChange={(o) => !o && setSelectedOffer(null)}
          readOnly
        />
      </div>
    </AppShell>
  );
}
