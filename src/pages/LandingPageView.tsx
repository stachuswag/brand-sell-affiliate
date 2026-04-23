import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
  CheckCircle2,
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
  logo_url: string | null;
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

export default function LandingPageView() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const [page, setPage] = useState<LandingPage | null>(null);
  const [linkInfo, setLinkInfo] = useState<LinkInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", message: "" });
  const [contactEmail, setContactEmail] = useState(false);
  const [contactPhone, setContactPhone] = useState(false);
  const [rodoAccepted, setRodoAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeImage, setActiveImage] = useState(0);

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
    if (!form.full_name.trim() || !rodoAccepted) return;
    setSaving(true);

    const messageWithPrefs = [
      form.message,
      contactEmail ? "[Preferowany kontakt: e-mail]" : "",
      contactPhone ? "[Preferowany kontakt: telefon]" : "",
    ].filter(Boolean).join(" ").trim() || null;

    const { error } = await supabase.from("contacts").insert({
      affiliate_link_id: linkInfo?.id ?? null,
      full_name: form.full_name,
      email: form.email || null,
      phone: form.phone || null,
      message: messageWithPrefs,
    });

    setSaving(false);
    if (error) {
      toast({ title: "Błąd", description: "Nie udało się wysłać formularza.", variant: "destructive" });
    } else {
      setSubmitted(true);
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
      <div className="min-h-screen flex items-center justify-center bg-neutral-900 text-white px-4">
        <div className="text-center max-w-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 mx-auto mb-6">
            <Building2 className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-light tracking-wide">Strona niedostępna</h1>
          <p className="text-sm text-white/60 mt-3">Ta strona nie istnieje lub jest niedostępna.</p>
        </div>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-900">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    );
  }

  const content: LandingContent = page.generated_content ?? {};
  const images = page.images ?? [];
  const accentColor = content.accent_color ?? "#b8972c";
  const heroImg = images[activeImage] ?? page.hero_image_url;

  if (submitted) {
    return (
      <div className="min-h-screen relative flex items-center justify-center px-4 text-white">
        {heroImg && (
          <div className="absolute inset-0">
            <img src={heroImg} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/60" />
          </div>
        )}
        <div className="relative text-center max-w-md">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 backdrop-blur-md border border-white/20 mx-auto mb-8">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h1 className="text-4xl md:text-5xl font-light tracking-wide">Dziękujemy</h1>
          <p className="text-white/80 mt-6 text-lg leading-relaxed font-light">
            Twoje zapytanie zostało wysłane. Nasz doradca skontaktuje się z Tobą wkrótce.
          </p>
          {linkInfo?.partners?.name && (
            <p className="text-white/60 text-sm mt-8 tracking-wide uppercase">
              Kontakt przez: <strong className="text-white/90 font-normal">{linkInfo.partners.name}</strong>
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative text-white">
      {/* Fullscreen background image */}
      {heroImg ? (
        <div className="fixed inset-0 -z-10">
          <img src={heroImg} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/20 to-black/40" />
        </div>
      ) : (
        <div className="fixed inset-0 -z-10 bg-neutral-900" />
      )}

      {/* Top brand bar (no nav tabs) */}
      <header className="relative z-10 px-8 md:px-14 py-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {page.logo_url ? (
            <div className="h-14 w-14 flex items-center justify-center">
              <img
                src={page.logo_url}
                alt={page.title}
                className="max-h-14 max-w-[120px] object-contain"
              />
            </div>
          ) : (
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full border border-white/40"
              style={{ borderColor: "rgba(255,255,255,0.5)" }}
            >
              <Building2 className="h-6 w-6 text-white" />
            </div>
          )}
          <div className="leading-tight">
            <div className="text-base font-medium tracking-[0.2em] uppercase">{page.title}</div>
            {linkInfo?.partners?.name && (
              <div className="text-[10px] tracking-[0.25em] uppercase text-white/70">
                Partner · {linkInfo.partners.name}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main split layout */}
      <main className="relative z-10 min-h-[calc(100vh-104px)] grid grid-cols-1 lg:grid-cols-[1.2fr_minmax(420px,520px)] gap-0">
        {/* Left: hero text */}
        <section className="px-8 md:px-14 py-16 lg:py-24 flex flex-col justify-end">
          {content.headline && (
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-light leading-[1.05] max-w-2xl tracking-tight drop-shadow-[0_2px_20px_rgba(0,0,0,0.5)]">
              {content.headline}
            </h1>
          )}
          {content.subheadline && (
            <p className="mt-8 text-lg md:text-xl text-white/85 max-w-xl font-light leading-relaxed">
              {content.subheadline}
            </p>
          )}
          {content.benefits && content.benefits.length > 0 && (
            <ul className="mt-10 space-y-3 max-w-xl">
              {content.benefits.slice(0, 4).map((b, i) => (
                <li key={i} className="flex items-start gap-3 text-white/90">
                  <CheckCircle className="h-5 w-5 mt-0.5 shrink-0" style={{ color: accentColor }} />
                  <span className="font-light">{b}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Right: form panel */}
        <aside className="px-8 md:px-14 py-12 lg:py-16 lg:pr-14 flex items-center">
          <div
            id="contact-form"
            className="w-full bg-neutral-900/55 backdrop-blur-xl border border-white/15 rounded-sm p-8 md:p-10 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)]"
          >
            <h2 className="text-3xl md:text-4xl font-light tracking-wide uppercase leading-tight">
              {content.contact_title ?? "Jesteś zainteresowany?"}
            </h2>
            <p className="mt-4 text-white/75 font-light leading-relaxed">
              {content.contact_description ?? "Zostaw nam swój numer — nasz doradca skontaktuje się z Tobą."}
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div>
                <Label htmlFor="lp-name" className="sr-only">Imię i nazwisko</Label>
                <Input
                  id="lp-name"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="Imię i nazwisko *"
                  required
                  maxLength={100}
                  className="bg-transparent border-0 border-b border-white/30 rounded-none h-12 px-0 text-white placeholder:text-white/60 focus-visible:ring-0 focus-visible:border-white"
                />
              </div>
              <div>
                <Label htmlFor="lp-phone" className="sr-only">Telefon</Label>
                <Input
                  id="lp-phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="Telefon"
                  maxLength={30}
                  className="bg-transparent border-0 border-b border-white/30 rounded-none h-12 px-0 text-white placeholder:text-white/60 focus-visible:ring-0 focus-visible:border-white"
                />
              </div>
              <div>
                <Label htmlFor="lp-email" className="sr-only">Email</Label>
                <Input
                  id="lp-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="Email"
                  maxLength={255}
                  className="bg-transparent border-0 border-b border-white/30 rounded-none h-12 px-0 text-white placeholder:text-white/60 focus-visible:ring-0 focus-visible:border-white"
                />
              </div>

              <div className="space-y-3 pt-2">
                <label className="flex items-center gap-3 cursor-pointer text-sm text-white/85">
                  <Checkbox
                    checked={contactEmail}
                    onCheckedChange={(v) => setContactEmail(v === true)}
                    className="border-white/50 data-[state=checked]:bg-white data-[state=checked]:text-neutral-900 rounded-full h-5 w-5"
                  />
                  <span className="font-light">Proszę o kontakt mailowy.</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer text-sm text-white/85">
                  <Checkbox
                    checked={contactPhone}
                    onCheckedChange={(v) => setContactPhone(v === true)}
                    className="border-white/50 data-[state=checked]:bg-white data-[state=checked]:text-neutral-900 rounded-full h-5 w-5"
                  />
                  <span className="font-light">Proszę o kontakt telefoniczny.</span>
                </label>
              </div>

              <div>
                <Label htmlFor="lp-message" className="sr-only">Wiadomość</Label>
                <Textarea
                  id="lp-message"
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder="Wiadomość"
                  rows={3}
                  maxLength={1000}
                  className="bg-transparent border border-white/30 rounded-sm text-white placeholder:text-white/60 focus-visible:ring-0 focus-visible:border-white resize-none"
                />
              </div>

              {/* RODO consent */}
              <label className="flex items-start gap-3 cursor-pointer pt-2">
                <Checkbox
                  checked={rodoAccepted}
                  onCheckedChange={(v) => setRodoAccepted(v === true)}
                  className="border-white/50 data-[state=checked]:bg-white data-[state=checked]:text-neutral-900 mt-1 h-4 w-4"
                  required
                />
                <span className="text-[11px] leading-relaxed text-white/70 font-light text-justify">
                  Wyrażam zgodę na przetwarzanie danych osobowych w postaci imienia i nazwiska,
                  adresu e-mail, numeru telefonu, informacji dotyczących preferencji zakupowych
                  i innych danych osobowych przekazanych w wiadomości w celu marketingu bezpośredniego
                  produktów i usług przez {linkInfo?.partners?.name || "Brand and Sell"}. *
                </span>
              </label>

              <p className="text-[10px] leading-relaxed text-white/50 font-light text-justify">
                Zostałam/em poinformowana/y, że w dowolnym momencie mam prawo wycofać zgodę na
                przetwarzanie moich danych osobowych. Wycofanie zgody na przetwarzanie danych
                osobowych nie wpływa na zgodność z prawem przetwarzania, którego dokonano na
                podstawie zgody przed jej wycofaniem. Administratorem danych jest{" "}
                {linkInfo?.partners?.name || "Brand and Sell"}. Dane przetwarzane są zgodnie z RODO.
              </p>

              <button
                type="submit"
                disabled={saving || !form.full_name.trim() || !rodoAccepted}
                className="w-full h-13 py-4 mt-2 text-sm font-medium tracking-[0.2em] uppercase text-neutral-900 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
                style={{ background: "white" }}
              >
                {saving ? "Wysyłanie..." : (content.cta_text ?? "Wyślij zapytanie")}
              </button>
            </form>
          </div>
        </aside>
      </main>

      {/* Image dots */}
      {images.length > 1 && (
        <div className="relative z-10 flex justify-center gap-2 pb-10 px-6">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveImage(i)}
              aria-label={`Zdjęcie ${i + 1}`}
              className={cn(
                "h-1 rounded-full transition-all duration-500",
                i === activeImage ? "w-10 bg-white" : "w-1 bg-white/40 hover:bg-white/70"
              )}
            />
          ))}
        </div>
      )}

      {/* Description (optional, below the fold) */}
      {(content.description || page.description) && (
        <section className="relative z-10 bg-neutral-950/85 backdrop-blur-xl py-24 px-8 md:px-14">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-xl md:text-2xl text-white/85 leading-relaxed font-light">
              {content.description ?? page.description}
            </p>
          </div>
        </section>
      )}

      {/* Features */}
      {content.features && content.features.length > 0 && (
        <section className="relative z-10 bg-neutral-950/85 backdrop-blur-xl py-24 px-8 md:px-14 border-t border-white/5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 max-w-7xl mx-auto">
            {content.features.map((f, i) => {
              const Icon = ICON_MAP[f.icon] ?? Home;
              return (
                <div key={i} className="space-y-4">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-full border border-white/20"
                  >
                    <Icon className="h-5 w-5" style={{ color: accentColor }} />
                  </div>
                  <h3 className="font-light text-white text-lg tracking-wide uppercase">{f.title}</h3>
                  <p className="text-sm text-white/60 leading-relaxed font-light">{f.description}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="relative z-10 bg-neutral-950 py-10 px-8 text-center border-t border-white/5">
        <p className="text-white/40 text-xs tracking-[0.2em] uppercase font-light">
          {content.footer_text ?? "© Brand and Sell"}
        </p>
      </footer>
    </div>
  );
}
