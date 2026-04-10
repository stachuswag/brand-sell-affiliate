import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Building2, CheckCircle2, Phone, Mail, MessageSquare, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface LinkInfo {
  id: string;
  tracking_code: string;
  destination_url: string | null;
  property_name: string | null;
  landing_page_id: string | null;
  is_active: boolean;
  partner_id: string;
  partners: { name: string } | null;
}

export default function TrackingRedirect() {
  const { code } = useParams<{ code: string }>();
  const { toast } = useToast();
  const [linkInfo, setLinkInfo] = useState<LinkInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", message: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const track = async () => {
      if (!code) return;

      const { data: link } = await supabase
        .from("affiliate_links")
        .select("id, tracking_code, destination_url, property_name, landing_page_id, is_active, partner_id, partners(name)")
        .eq("tracking_code", code)
        .maybeSingle();

      if (!link || !link.is_active) {
        setNotFound(true);
        return;
      }

      setLinkInfo(link as LinkInfo);

      // Register click
      await supabase.from("link_clicks").insert({
        affiliate_link_id: link.id,
        user_agent: navigator.userAgent,
        referrer: document.referrer || null,
      });

      const lp = (link as { landing_page_id: string | null }).landing_page_id;

      if (lp) {
        // Redirect to landing page
        window.location.href = `${window.location.origin}/lp/${lp}?ref=${code}`;
      } else if (link.destination_url) {
        // Redirect to external URL after short delay
        setRedirecting(true);
        setTimeout(() => {
          window.location.href = link.destination_url!;
        }, 1500);
      } else {
        setShowForm(true);
      }
    };

    track();
  }, [code]);

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
      toast({ title: "Błąd", description: "Nie udało się wysłać formularza. Spróbuj ponownie.", variant: "destructive" });
    } else {
      setSubmitted(true);
      // Send SMS notification
      supabase.functions.invoke("notify-sms", {
        body: {
          full_name: form.full_name,
          email: form.email,
          phone: form.phone,
          source: "link_afiliacyjny",
          partner_name: linkInfo?.partners?.name || "",
          offer_name: linkInfo?.property_name || "",
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
          <h1 className="text-xl font-bold text-foreground">Link niedostępny</h1>
          <p className="text-sm text-muted-foreground mt-2">Ten link afiliacyjny jest nieaktywny lub nie istnieje.</p>
        </div>
      </div>
    );
  }

  if (redirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center max-w-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground mx-auto mb-4 animate-pulse">
            <Building2 className="h-7 w-7" />
          </div>
          <h1 className="text-lg font-semibold text-foreground">Przekierowywanie...</h1>
          <p className="text-sm text-muted-foreground mt-2">Za chwilę zostaniesz przeniesiony na stronę Brand and Sell.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center max-w-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-100 text-green-600 mx-auto mb-4">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Dziękujemy za kontakt!</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Twoje zapytanie zostało przesłane. Skontaktujemy się z Tobą wkrótce.
          </p>
          {linkInfo?.partners?.name && (
            <p className="text-xs text-muted-foreground mt-3">
              Kontakt nawiązany przez partnera: <strong>{linkInfo.partners.name}</strong>
            </p>
          )}
        </div>
      </div>
    );
  }

  if (!showForm || !linkInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground mx-auto mb-4 shadow-lg">
            <Building2 className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Brand and Sell</h1>
          {linkInfo.property_name && (
            <p className="text-sm text-muted-foreground mt-1">
              Zapytanie o: <strong>{linkInfo.property_name}</strong>
            </p>
          )}
          {linkInfo.partners?.name && (
            <p className="text-xs text-muted-foreground mt-1">
              Rekomendacja od: {linkInfo.partners.name}
            </p>
          )}
        </div>

        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Formularz kontaktowy</CardTitle>
            <CardDescription>Wypełnij formularz, a nasz doradca skontaktuje się z Tobą.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="f-name" className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" /> Imię i nazwisko *
                </Label>
                <Input
                  id="f-name"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="Jan Kowalski"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="f-email" className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" /> Email
                  </Label>
                  <Input
                    id="f-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="jan@email.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="f-phone" className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" /> Telefon
                  </Label>
                  <Input
                    id="f-phone"
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+48 123 456 789"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="f-message" className="flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5" /> Wiadomość
                </Label>
                <Textarea
                  id="f-message"
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder="Opisz swoje potrzeby..."
                  rows={3}
                />
              </div>
              <Button type="submit" className="w-full" disabled={saving || !form.full_name.trim()}>
                {saving ? "Wysyłanie..." : "Wyślij zapytanie"}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Wypełniając formularz zgadzasz się na kontakt telefoniczny lub emailowy od Brand and Sell.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
