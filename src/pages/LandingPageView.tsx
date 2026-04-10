import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Home,
  MapPin,
  Star,
  Shield,
  Building2,
  CheckCircle,
  Users,
  Award,
  TrendingUp,
  Key,
  Sun,
  Heart,
  Phone,
  Mail,
  MessageSquare,
  User,
  CheckCircle2,
  ChevronRight,
  Lock,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface LandingContent {
  headline?: string;
  subheadline?: string;
  description?: string;
  features?: { icon: string; title: string; description: string }[];
  cta_text?: string;
  cta_description?: string;
  contact_title?: string;
  contact_description?: string;
  footer_text?: string;
  benefits?: string[];
  accent_color?: string;
}

interface LandingPage {
  id: string;
  title: string;
  description: string | null;
  generated_content: LandingContent | null;
  hero_image_url: string | null;
  images: string[];
  is_published: boolean;
}

interface LinkInfo {
  id: string;
  tracking_code: string;
  property_name: string | null;
  partners: { name: string } | null;
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  home: Home,
  "map-pin": MapPin,
  star: Star,
  shield: Shield,
  building2: Building2,
  "check-circle": CheckCircle,
  users: Users,
  award: Award,
  "trending-up": TrendingUp,
  key: Key,
  sun: Sun,
  heart: Heart,
};

export default function LandingPageView() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const [page, setPage] = useState<LandingPage | null>(null);
  const [linkInfo, setLinkInfo] = useState<LinkInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", message: "" });
  const [saving, setSaving] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const [gateOpen, setGateOpen] = useState(false);
  const [gateUnlocked, setGateUnlocked] = useState(false);

  useEffect(() => {
    const loadPage = async (query: { id?: string; slug?: string }) => {
      let req = supabase.from("landing_pages").select("*").eq("is_published", true);
      if (query.id) req = req.eq("id", query.id);
      else if (query.slug) req = req.eq("slug", query.slug);
      const { data } = await req.maybeSingle();
      if (!data) { setNotFound(true); return; }
      setPage(data as LandingPage);
    };

    const load = async () => {
      if (!id) return;

      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

      if (!isUUID) {
        // Could be a tracking code OR a slug — check affiliate_links first
        const { data: link } = await supabase
          .from("affiliate_links")
          .select("id, tracking_code, property_name, landing_page_id, partners(name)")
          .eq("tracking_code", id)
          .eq("is_active", true)
          .maybeSingle();

        if (link && (link as { landing_page_id: string | null }).landing_page_id) {
          setLinkInfo(link as LinkInfo);
          await loadPage({ id: (link as { landing_page_id: string }).landing_page_id });
          return;
        }

        // Otherwise treat as slug
        await loadPage({ slug: id });
        return;
      }

      // UUID — load page, then check ?ref= query param to get affiliate link info
      await loadPage({ id });

      const refCode = searchParams.get("ref");
      if (refCode) {
        const { data: link } = await supabase
          .from("affiliate_links")
          .select("id, tracking_code, property_name, partners(name)")
          .eq("tracking_code", refCode)
          .eq("is_active", true)
          .maybeSingle();
        if (link) setLinkInfo(link as LinkInfo);
      }
    };

    load();
  }, [id, searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim()) return;
    setSaving(true);

    const { error } = await supabase.from("contacts").insert({
      affiliate_link_id: linkInfo?.id ?? null,
      full_name: form.full_name,
      email: form.email || null,
      phone: form.phone || null,
      message: form.message || null,
    });

    setSaving(false);
    if (error) {
      toast({ title: "Błąd", description: "Nie udało się wysłać formularza.", variant: "destructive" });
    } else {
      setSubmitted(true);
      setGateUnlocked(true);
      setGateOpen(false);
      // Send SMS notification
      supabase.functions.invoke("notify-sms", {
        body: {
          full_name: form.full_name,
          email: form.email,
          phone: form.phone,
          source: "landing_page",
          partner_name: linkInfo?.partners?.name || "",
          offer_name: page?.title || "",
        },
      }).catch(() => {});
    }
  };

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center max-w-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive mx-auto mb-4">
            <Building2 className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold">Strona niedostępna</h1>
          <p className="text-sm text-muted-foreground mt-2">Ta strona nie istnieje lub jest niedostępna.</p>
        </div>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const content: LandingContent = page.generated_content ?? {};
  const images = page.images ?? [];
  const accentColor = content.accent_color ?? "#b8972c";

  // Success screen
  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)" }}>
        <div className="text-center max-w-sm">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-500/20 text-green-400 mx-auto mb-6">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold text-white">Dziękujemy!</h1>
          <p className="text-slate-300 mt-3">
            Twoje zapytanie zostało wysłane. Nasz doradca skontaktuje się z Tobą wkrótce.
          </p>
          {linkInfo?.partners?.name && (
            <p className="text-slate-400 text-sm mt-4">
              Kontakt przez partnera: <strong className="text-white">{linkInfo.partners.name}</strong>
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Hero Section */}
      <section className="relative min-h-screen flex flex-col">
        {/* Background image */}
        {images.length > 0 ? (
          <div className="absolute inset-0">
            <img
              src={images[activeImage]}
              alt="Hero"
              className="w-full h-full object-cover transition-opacity duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-slate-950/60 via-slate-950/40 to-slate-950" />
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
        )}

        {/* Top bar */}
        <div className="relative z-10 flex items-center justify-between px-6 py-5">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5" style={{ color: accentColor }} />
            <span className="font-bold text-white text-sm">Brand and Sell</span>
          </div>
          {linkInfo?.partners?.name && (
            <span className="text-xs text-white/60">Partner: {linkInfo.partners.name}</span>
          )}
        </div>

        {/* Hero content */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-20 text-center">
          {content.headline ? (
            <>
              <h1 className="text-4xl md:text-6xl font-bold text-white leading-tight max-w-4xl">
                {content.headline}
              </h1>
              {content.subheadline && (
                <p className="mt-4 text-lg md:text-xl text-white/80 max-w-2xl">
                  {content.subheadline}
                </p>
              )}
            </>
          ) : (
            <h1 className="text-4xl md:text-6xl font-bold text-white leading-tight max-w-4xl">
              {page.title}
            </h1>
          )}

          {content.benefits && content.benefits.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
              {content.benefits.map((b, i) => (
                <span
                  key={i}
                  className="flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium text-white/90"
                  style={{ background: `${accentColor}30`, border: `1px solid ${accentColor}50` }}
                >
                  <CheckCircle className="h-3.5 w-3.5" style={{ color: accentColor }} />
                  {b}
                </span>
              ))}
            </div>
          )}

          <button
            onClick={() => setGateOpen(true)}
            className="mt-10 inline-flex items-center gap-2 rounded-xl px-8 py-4 text-base font-semibold text-white shadow-lg transition-transform hover:scale-105"
            style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)` }}
          >
            {content.cta_text ?? "Umów bezpłatną konsultację"}
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Image thumbnails */}
        {images.length > 1 && (
          <div className="relative z-10 flex justify-center gap-2 pb-6 px-6">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveImage(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === activeImage ? "w-8" : "w-1.5 bg-white/30"
                )}
                style={i === activeImage ? { background: accentColor, width: "2rem" } : {}}
              />
            ))}
          </div>
        )}
      </section>

      {/* Gallery (if multiple images) */}
      {images.length > 1 && (
        <section className="py-16 px-6 max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {images.map((img, i) => (
              <div
                key={i}
                className={cn(
                  "relative overflow-hidden rounded-xl cursor-pointer transition-all hover:scale-[1.02]",
                  i === 0 ? "col-span-2 row-span-2 aspect-square" : "aspect-square"
                )}
                onClick={() => setActiveImage(i)}
              >
                <img src={img} alt={`Zdjęcie ${i + 1}`} className="w-full h-full object-cover" />
                {i === activeImage && (
                  <div className="absolute inset-0 ring-2 ring-inset rounded-xl" style={{ borderColor: accentColor }} />
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Description */}
      {(content.description || page.description) && (
        <section className={cn("py-16 px-6 max-w-4xl mx-auto text-center relative", !gateUnlocked && "select-none")}>
          <div className={cn(!gateUnlocked && "blur-sm")}>
            <p className="text-lg text-slate-300 leading-relaxed">
              {content.description ?? page.description}
            </p>
          </div>
          {!gateUnlocked && (
            <div className="absolute inset-0 flex items-center justify-center">
              <button
                onClick={() => setGateOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-lg transition-transform hover:scale-105"
                style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)` }}
              >
                <Lock className="h-4 w-4" /> Wypełnij formularz, aby zobaczyć więcej
              </button>
            </div>
          )}
        </section>
      )}

      {/* Features */}
      {content.features && content.features.length > 0 && (
        <section className={cn("py-16 px-6 max-w-6xl mx-auto relative", !gateUnlocked && "select-none")}>
          <div className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6", !gateUnlocked && "blur-sm pointer-events-none")}>
            {content.features.map((f, i) => {
              const Icon = ICON_MAP[f.icon] ?? Home;
              return (
                <div
                  key={i}
                  className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-3 hover:border-slate-700 transition-colors"
                >
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-xl"
                    style={{ background: `${accentColor}20` }}
                  >
                    <Icon className="h-5 w-5" style={{ color: accentColor }} />
                  </div>
                  <h3 className="font-semibold text-white">{f.title}</h3>
                  <p className="text-sm text-slate-400">{f.description}</p>
                </div>
              );
            })}
          </div>
          {!gateUnlocked && (
            <div className="absolute inset-0 flex items-center justify-center">
              <button
                onClick={() => setGateOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-lg transition-transform hover:scale-105"
                style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)` }}
              >
                <Lock className="h-4 w-4" /> Zostaw dane, aby odblokować szczegóły
              </button>
            </div>
          )}
        </section>
      )}

      {/* Contact Form (visible only when unlocked, otherwise shown as gate popup) */}
      {gateUnlocked && (
        <section id="contact-form" className="py-20 px-6">
          <div className="max-w-lg mx-auto">
            <div className="rounded-3xl bg-slate-900 border border-slate-800 p-8 shadow-2xl text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-500/20 text-green-400 mx-auto mb-6">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h2 className="text-2xl font-bold text-white">Dziękujemy za zainteresowanie!</h2>
              <p className="text-slate-400 mt-3 text-sm">
                Nasz doradca skontaktuje się z Tobą wkrótce.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Gate Popup Dialog */}
      <Dialog open={gateOpen} onOpenChange={setGateOpen}>
        <DialogContent className="max-w-md border-slate-800 bg-slate-900 text-white">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <MessageSquare className="h-5 w-5" style={{ color: accentColor }} />
              {content.contact_title ?? "Zostaw swoje dane"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-slate-400 text-sm">
            {content.contact_description ?? "Wypełnij formularz, aby zobaczyć pełne szczegóły oferty. Nasz doradca skontaktuje się z Tobą w ciągu 24 godzin."}
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="gate-name" className="text-slate-300 flex items-center gap-1.5 text-sm">
                <User className="h-3.5 w-3.5" /> Imię i nazwisko *
              </Label>
              <Input
                id="gate-name"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="Jan Kowalski"
                required
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="gate-email" className="text-slate-300 flex items-center gap-1.5 text-sm">
                  <Mail className="h-3.5 w-3.5" /> Email
                </Label>
                <Input
                  id="gate-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="jan@email.com"
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gate-phone" className="text-slate-300 flex items-center gap-1.5 text-sm">
                  <Phone className="h-3.5 w-3.5" /> Telefon
                </Label>
                <Input
                  id="gate-phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+48 123 456 789"
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="gate-message" className="text-slate-300 flex items-center gap-1.5 text-sm">
                <MessageSquare className="h-3.5 w-3.5" /> Wiadomość
              </Label>
              <Textarea
                id="gate-message"
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder="Opisz swoje potrzeby..."
                rows={3}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 resize-none"
              />
            </div>
            <button
              type="submit"
              disabled={saving || !form.full_name.trim()}
              className="w-full rounded-xl px-6 py-3.5 font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)` }}
            >
              {saving ? "Wysyłanie..." : (content.cta_text ?? "Wyślij i odblokuj szczegóły")}
            </button>
            <p className="text-xs text-center text-slate-500">
              Wypełniając formularz zgadzasz się na kontakt ze strony Brand and Sell.
            </p>
          </form>
        </DialogContent>
      </Dialog>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-slate-800 text-center">
        <p className="text-slate-500 text-sm">
          {content.footer_text ?? "© Brand and Sell — System afiliacyjny nieruchomości"}
        </p>
      </footer>
    </div>
  );
}
