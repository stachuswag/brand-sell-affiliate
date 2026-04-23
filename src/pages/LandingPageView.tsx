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
  partner_id: string;
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

/** Aurora — fluid, oversized blurred shapes that the glass refracts. */
function Aurora({ accent }: { accent: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute -top-40 -left-40 h-[42rem] w-[42rem] rounded-full blur-3xl opacity-40"
        style={{ background: `radial-gradient(circle at 30% 30%, ${accent}, transparent 60%)` }}
      />
      <div
        className="absolute top-1/3 -right-40 h-[36rem] w-[36rem] rounded-full blur-3xl opacity-30"
        style={{ background: `radial-gradient(circle at 70% 50%, #6366f1, transparent 60%)` }}
      />
      <div
        className="absolute -bottom-40 left-1/3 h-[40rem] w-[40rem] rounded-full blur-3xl opacity-30"
        style={{ background: `radial-gradient(circle at 50% 50%, #ec4899, transparent 60%)` }}
      />
      <div
        className="absolute top-1/2 left-1/4 h-[28rem] w-[28rem] rounded-full blur-3xl opacity-20"
        style={{ background: `radial-gradient(circle at 50% 50%, #22d3ee, transparent 60%)` }}
      />
    </div>
  );
}

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
        const { data: link } = await supabase
          .from("affiliate_links")
          .select("id, tracking_code, property_name, landing_page_id, partner_id, partners(name)")
          .eq("tracking_code", id)
          .eq("is_active", true)
          .maybeSingle();

        if (link && (link as { landing_page_id: string | null }).landing_page_id) {
          setLinkInfo(link as LinkInfo);
          await loadPage({ id: (link as { landing_page_id: string }).landing_page_id });
          return;
        }

        await loadPage({ slug: id });
        return;
      }

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
      supabase.functions.invoke("notify-sms", {
        body: {
          full_name: form.full_name,
          email: form.email,
          phone: form.phone,
          source: "landing_page",
          partner_name: linkInfo?.partners?.name || "",
          offer_name: page?.title || "",
          partner_id: linkInfo?.partner_id || "",
        },
      }).catch(() => {});
    }
  };

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 relative overflow-hidden">
        <Aurora accent="#b8972c" />
        <div className="relative text-center max-w-sm rounded-3xl border border-white/10 bg-white/5 backdrop-blur-2xl p-12 shadow-[0_8px_60px_-12px_rgba(0,0,0,0.5)]">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/20 text-destructive mx-auto mb-6 backdrop-blur-xl border border-white/10">
            <Building2 className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tighter text-white">Strona niedostępna</h1>
          <p className="text-sm text-white/60 mt-3">Ta strona nie istnieje lub jest niedostępna.</p>
        </div>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-white" />
      </div>
    );
  }

  const content: LandingContent = page.generated_content ?? {};
  const images = page.images ?? [];
  const accentColor = content.accent_color ?? "#b8972c";

  // Success screen
  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-slate-950 relative overflow-hidden">
        <Aurora accent={accentColor} />
        <div className="relative text-center max-w-md rounded-[2rem] border border-white/15 bg-white/5 backdrop-blur-3xl p-12 shadow-[0_20px_80px_-20px_rgba(0,0,0,0.6)]">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-green-500/15 text-green-300 mx-auto mb-8 border border-green-400/20 backdrop-blur-xl">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <h1 className="text-4xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-br from-white via-white to-white/60">
            Dziękujemy!
          </h1>
          <p className="text-white/70 mt-4 text-lg leading-relaxed">
            Twoje zapytanie zostało wysłane. Nasz doradca skontaktuje się z Tobą wkrótce.
          </p>
          {linkInfo?.partners?.name && (
            <p className="text-white/50 text-sm mt-6">
              Kontakt przez partnera: <strong className="text-white/90">{linkInfo.partners.name}</strong>
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white relative overflow-hidden">
      {/* Global aurora behind everything */}
      <div className="fixed inset-0 -z-0">
        <Aurora accent={accentColor} />
      </div>

      {/* Hero Section */}
      <section className="relative min-h-screen flex flex-col">
        {/* Background image with stronger gradient overlay */}
        {images.length > 0 ? (
          <div className="absolute inset-0">
            <img
              src={images[activeImage]}
              alt="Hero"
              className="w-full h-full object-cover transition-opacity duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-slate-950/70 via-slate-950/50 to-slate-950" />
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
        )}

        {/* Top bar — glass pill */}
        <div className="relative z-10 px-6 py-6 flex justify-center">
          <div className="flex items-center justify-between gap-6 rounded-full border border-white/15 bg-white/5 backdrop-blur-2xl px-6 py-3 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.4)] w-full max-w-3xl">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5" style={{ color: accentColor }} />
              <span className="font-semibold text-white text-sm tracking-tight">Brand and Sell</span>
            </div>
            {linkInfo?.partners?.name && (
              <span className="text-xs text-white/60 truncate">Partner: {linkInfo.partners.name}</span>
            )}
          </div>
        </div>

        {/* Hero content */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-32 text-center">
          {content.headline ? (
            <>
              <h1 className="text-5xl md:text-7xl font-bold leading-[1.05] max-w-5xl tracking-tighter bg-clip-text text-transparent bg-gradient-to-br from-white via-white to-white/50 drop-shadow-[0_2px_20px_rgba(0,0,0,0.5)]">
                {content.headline}
              </h1>
              {content.subheadline && (
                <p className="mt-8 text-lg md:text-2xl text-white/70 max-w-3xl font-light leading-relaxed">
                  {content.subheadline}
                </p>
              )}
            </>
          ) : (
            <h1 className="text-5xl md:text-7xl font-bold leading-[1.05] max-w-5xl tracking-tighter bg-clip-text text-transparent bg-gradient-to-br from-white via-white to-white/50">
              {page.title}
            </h1>
          )}

          {content.benefits && content.benefits.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-3 mt-12">
              {content.benefits.map((b, i) => (
                <span
                  key={i}
                  className="flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium text-white/90 border border-white/15 bg-white/5 backdrop-blur-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.3)] transition-all duration-500 ease-out hover:-translate-y-0.5 hover:bg-white/10"
                >
                  <CheckCircle className="h-4 w-4" style={{ color: accentColor }} />
                  {b}
                </span>
              ))}
            </div>
          )}

          <button
            onClick={() => setGateOpen(true)}
            className="group mt-14 inline-flex items-center gap-3 rounded-full px-10 py-5 text-base font-semibold text-white border border-white/20 backdrop-blur-2xl transition-all duration-500 ease-out hover:-translate-y-1"
            style={{
              background: `linear-gradient(135deg, ${accentColor}ee, ${accentColor}99)`,
              boxShadow: `0 20px 60px -15px ${accentColor}80, 0 0 0 1px ${accentColor}30 inset`,
            }}
          >
            {content.cta_text ?? "Umów bezpłatną konsultację"}
            <ChevronRight className="h-4 w-4 transition-transform duration-500 group-hover:translate-x-1" />
          </button>
        </div>

        {/* Image dots */}
        {images.length > 1 && (
          <div className="relative z-10 flex justify-center gap-2 pb-10 px-6">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveImage(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-500",
                  i === activeImage ? "w-10" : "w-1.5 bg-white/30 hover:bg-white/50"
                )}
                style={i === activeImage ? { background: accentColor } : {}}
              />
            ))}
          </div>
        )}
      </section>

      {/* Gallery */}
      {images.length > 1 && (
        <section className="relative py-24 px-6 max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {images.map((img, i) => (
              <div
                key={i}
                className={cn(
                  "relative overflow-hidden rounded-3xl cursor-pointer transition-all duration-500 ease-out hover:-translate-y-1 hover:shadow-2xl border border-white/10",
                  i === 0 ? "col-span-2 row-span-2 aspect-square" : "aspect-square"
                )}
                onClick={() => setActiveImage(i)}
              >
                <img src={img} alt={`Zdjęcie ${i + 1}`} className="w-full h-full object-cover transition-transform duration-700 hover:scale-105" />
                {i === activeImage && (
                  <div className="absolute inset-0 ring-2 ring-inset rounded-3xl" style={{ borderColor: accentColor }} />
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Description */}
      {(content.description || page.description) && (
        <section className={cn("relative py-32 px-6 max-w-4xl mx-auto text-center", !gateUnlocked && "select-none")}>
          <div className={cn("rounded-[2rem] border border-white/10 bg-white/5 backdrop-blur-3xl p-12 md:p-16 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)]", !gateUnlocked && "blur-md")}>
            <p className="text-xl md:text-2xl text-white/80 leading-relaxed font-light tracking-tight">
              {content.description ?? page.description}
            </p>
          </div>
          {!gateUnlocked && (
            <div className="absolute inset-0 flex items-center justify-center">
              <button
                onClick={() => setGateOpen(true)}
                className="inline-flex items-center gap-2 rounded-full px-8 py-4 text-sm font-semibold text-white border border-white/20 backdrop-blur-2xl transition-all duration-500 ease-out hover:-translate-y-1"
                style={{
                  background: `linear-gradient(135deg, ${accentColor}ee, ${accentColor}99)`,
                  boxShadow: `0 15px 50px -10px ${accentColor}80`,
                }}
              >
                <Lock className="h-4 w-4" /> Wypełnij formularz, aby zobaczyć więcej
              </button>
            </div>
          )}
        </section>
      )}

      {/* Features */}
      {content.features && content.features.length > 0 && (
        <section className={cn("relative py-32 px-6 max-w-7xl mx-auto", !gateUnlocked && "select-none")}>
          <div className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6", !gateUnlocked && "blur-md pointer-events-none")}>
            {content.features.map((f, i) => {
              const Icon = ICON_MAP[f.icon] ?? Home;
              return (
                <div
                  key={i}
                  className="group rounded-3xl border border-white/10 bg-white/5 backdrop-blur-2xl p-8 space-y-4 transition-all duration-500 ease-out hover:-translate-y-1 hover:bg-white/10 hover:border-white/20 hover:shadow-2xl"
                  style={{ boxShadow: `0 10px 40px -15px ${accentColor}30` }}
                >
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 backdrop-blur-xl transition-transform duration-500 group-hover:scale-110"
                    style={{ background: `${accentColor}25` }}
                  >
                    <Icon className="h-6 w-6" style={{ color: accentColor }} />
                  </div>
                  <h3 className="font-semibold text-white text-lg tracking-tight">{f.title}</h3>
                  <p className="text-sm text-white/60 leading-relaxed">{f.description}</p>
                </div>
              );
            })}
          </div>
          {!gateUnlocked && (
            <div className="absolute inset-0 flex items-center justify-center">
              <button
                onClick={() => setGateOpen(true)}
                className="inline-flex items-center gap-2 rounded-full px-8 py-4 text-sm font-semibold text-white border border-white/20 backdrop-blur-2xl transition-all duration-500 ease-out hover:-translate-y-1"
                style={{
                  background: `linear-gradient(135deg, ${accentColor}ee, ${accentColor}99)`,
                  boxShadow: `0 15px 50px -10px ${accentColor}80`,
                }}
              >
                <Lock className="h-4 w-4" /> Zostaw dane, aby odblokować szczegóły
              </button>
            </div>
          )}
        </section>
      )}

      {/* Contact unlocked card */}
      {gateUnlocked && (
        <section id="contact-form" className="relative py-32 px-6">
          <div className="max-w-lg mx-auto">
            <div className="rounded-[2rem] border border-white/15 bg-white/5 backdrop-blur-3xl p-12 text-center shadow-[0_20px_80px_-20px_rgba(0,0,0,0.6)]">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-green-500/15 text-green-300 mx-auto mb-8 border border-green-400/20 backdrop-blur-xl">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <h2 className="text-3xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-br from-white to-white/60">
                Dziękujemy za zainteresowanie!
              </h2>
              <p className="text-white/60 mt-4 text-base leading-relaxed">
                Nasz doradca skontaktuje się z Tobą wkrótce.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Gate Popup */}
      <Dialog open={gateOpen} onOpenChange={setGateOpen}>
        <DialogContent className="max-w-md border-white/15 bg-slate-950/80 backdrop-blur-3xl text-white rounded-3xl p-8 shadow-[0_30px_100px_-20px_rgba(0,0,0,0.8)]">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2 text-xl tracking-tight">
              <MessageSquare className="h-5 w-5" style={{ color: accentColor }} />
              {content.contact_title ?? "Zostaw swoje dane"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-white/60 text-sm leading-relaxed">
            {content.contact_description ?? "Wypełnij formularz, aby zobaczyć pełne szczegóły oferty. Nasz doradca skontaktuje się z Tobą w ciągu 24 godzin."}
          </p>
          <form onSubmit={handleSubmit} className="space-y-5 mt-2">
            <div className="space-y-2">
              <Label htmlFor="gate-name" className="text-white/70 flex items-center gap-1.5 text-sm">
                <User className="h-3.5 w-3.5" /> Imię i nazwisko *
              </Label>
              <Input
                id="gate-name"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="Jan Kowalski"
                required
                className="bg-white/5 border-white/15 text-white placeholder:text-white/30 backdrop-blur-xl rounded-xl h-11"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="gate-email" className="text-white/70 flex items-center gap-1.5 text-sm">
                  <Mail className="h-3.5 w-3.5" /> Email
                </Label>
                <Input
                  id="gate-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="jan@email.com"
                  className="bg-white/5 border-white/15 text-white placeholder:text-white/30 backdrop-blur-xl rounded-xl h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gate-phone" className="text-white/70 flex items-center gap-1.5 text-sm">
                  <Phone className="h-3.5 w-3.5" /> Telefon
                </Label>
                <Input
                  id="gate-phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+48 123 456 789"
                  className="bg-white/5 border-white/15 text-white placeholder:text-white/30 backdrop-blur-xl rounded-xl h-11"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="gate-message" className="text-white/70 flex items-center gap-1.5 text-sm">
                <MessageSquare className="h-3.5 w-3.5" /> Wiadomość
              </Label>
              <Textarea
                id="gate-message"
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder="Opisz swoje potrzeby..."
                rows={3}
                className="bg-white/5 border-white/15 text-white placeholder:text-white/30 backdrop-blur-xl rounded-2xl resize-none"
              />
            </div>
            <button
              type="submit"
              disabled={saving || !form.full_name.trim()}
              className="w-full rounded-full px-6 py-4 font-semibold text-white border border-white/20 backdrop-blur-2xl transition-all duration-500 ease-out hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              style={{
                background: `linear-gradient(135deg, ${accentColor}ee, ${accentColor}99)`,
                boxShadow: `0 15px 50px -10px ${accentColor}80`,
              }}
            >
              {saving ? "Wysyłanie..." : (content.cta_text ?? "Wyślij i odblokuj szczegóły")}
            </button>
            <p className="text-xs text-center text-white/40">
              Wypełniając formularz zgadzasz się na kontakt ze strony Brand and Sell.
            </p>
          </form>
        </DialogContent>
      </Dialog>

      {/* Footer */}
      <footer className="relative py-12 px-6 border-t border-white/10 text-center backdrop-blur-xl">
        <p className="text-white/40 text-sm tracking-tight">
          {content.footer_text ?? "© Brand and Sell — System afiliacyjny nieruchomości"}
        </p>
      </footer>
    </div>
  );
}
