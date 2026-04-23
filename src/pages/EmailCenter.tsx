import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Send } from "lucide-react";
import { cn } from "@/lib/utils";

type EmailType = "onboard" | "general" | "follow_up" | "proposal" | "question";

interface Partner {
  id: string;
  name: string;
  email: string | null;
  contact_person: string | null;
  agent_user_id: string | null;
  agent_status: string | null;
  login_email: string | null;
}

interface Project {
  id: string;
  name: string;
}

const emailTypeOptions: { value: EmailType; label: string; description: string; icon: string }[] = [
  { value: "onboard", label: "Onboarding", description: "zatwierdzenie agenta + dane logowania", icon: "🚀" },
  { value: "general", label: "Ogólny", description: "podziękowanie i link afiliacyjny", icon: "✉️" },
  { value: "follow_up", label: "Follow-up", description: "krótkie przypomnienie", icon: "🔄" },
  { value: "proposal", label: "Propozycja", description: "własna propozycja współpracy", icon: "💡" },
  { value: "question", label: "Pytanie", description: "wiadomość z pytaniem", icon: "❓" },
];

const emailTypeSuccessLabels: Record<EmailType, string> = {
  onboard: "Onboarding wysłany! 🚀",
  general: "Email wysłany! ✉️",
  follow_up: "Follow-up wysłany! 🔄",
  proposal: "Propozycja wysłana! 💡",
  question: "Pytanie wysłane! ❓",
};

function generatePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#";
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export default function EmailCenter() {
  const { toast } = useToast();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedPartnerId, setSelectedPartnerId] = useState("");
  const [emailType, setEmailType] = useState<EmailType>("general");
  const [projectId, setProjectId] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [onboardPassword, setOnboardPassword] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from("partners").select("id, name, email, contact_person, agent_user_id, agent_status, login_email").eq("is_active", true).order("name"),
      supabase.from("projects").select("id, name").eq("is_active", true).order("name"),
    ]).then(([p, pr]) => {
      setPartners((p.data ?? []) as Partner[]);
      setProjects((pr.data ?? []) as Project[]);
      setLoading(false);
    });
  }, []);

  const selectedPartner = partners.find((p) => p.id === selectedPartnerId) || null;
  const isOnboardSent = selectedPartner?.agent_status === "approved";

  // When partner changes, auto-fill password for onboard if needed
  const handlePartnerChange = (id: string) => {
    setSelectedPartnerId(id);
    const p = partners.find((x) => x.id === id);
    if (p && emailType === "onboard" && p.agent_user_id && p.agent_status !== "approved") {
      setOnboardPassword(generatePassword());
    }
  };

  const handleEmailTypeChange = (type: EmailType) => {
    setEmailType(type);
    setCustomMessage("");
    if (type === "onboard" && selectedPartner?.agent_user_id && !isOnboardSent) {
      setOnboardPassword(generatePassword());
    } else {
      setOnboardPassword("");
    }
  };

  const canSend = () => {
    if (!selectedPartnerId) return false;
    if ((emailType === "proposal" || emailType === "question") && !customMessage.trim()) return false;
    if (emailType === "onboard" && isOnboardSent) return false;
    return true;
  };

  const handleSend = async () => {
    if (!selectedPartner || !canSend()) return;
    setSending(true);

    const { data: { session } } = await supabase.auth.getSession();

    try {
      const payload: Record<string, string | undefined> = {
        partner_id: selectedPartner.id,
        email_type: emailType,
      };
      if (projectId) payload.project_id = projectId;
      if (customMessage.trim()) payload.custom_message = customMessage.trim();

      // Handle onboard: create/reset account
      let finalPassword = onboardPassword;
      if (emailType === "onboard") {
        const loginEmail = selectedPartner.login_email || selectedPartner.email;
        if (!loginEmail) {
          toast({ title: "Błąd", description: "Partner nie ma emaila.", variant: "destructive" });
          setSending(false);
          return;
        }

        if (!selectedPartner.agent_user_id) {
          // Create account
          if (!finalPassword) finalPassword = generatePassword();
          const agentRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-agent`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}`, "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
            body: JSON.stringify({ action: "create", partner_id: selectedPartner.id, partner_name: selectedPartner.name, email: loginEmail, password: finalPassword }),
          });
          const agentResult = await agentRes.json();
          if (!agentRes.ok || agentResult.error) {
            toast({ title: "Błąd tworzenia konta", description: agentResult.error, variant: "destructive" });
            setSending(false);
            return;
          }
        } else if (finalPassword) {
          // Reset password
          const resetRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-agent`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}`, "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
            body: JSON.stringify({ action: "reset_password", user_id: selectedPartner.agent_user_id, password: finalPassword }),
          });
          const resetResult = await resetRes.json();
          if (!resetRes.ok || resetResult.error) {
            toast({ title: "Błąd resetu hasła", description: resetResult.error, variant: "destructive" });
            setSending(false);
            return;
          }
        }

        const loginEmailForMail = selectedPartner.login_email || selectedPartner.email;
        if (loginEmailForMail) payload.login_email = loginEmailForMail;
        if (finalPassword) payload.login_password = finalPassword;
      }

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/trigger-onboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}`, "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok || result.error) {
        toast({ title: "Błąd", description: result.error, variant: "destructive" });
      } else {
        toast({ title: emailTypeSuccessLabels[emailType], description: `Email do ${selectedPartner.name} na ${result.email}` });
        setCustomMessage("");
        setOnboardPassword("");
      }
    } catch {
      toast({ title: "Błąd wysyłki", variant: "destructive" });
    }
    setSending(false);
  };

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Centrum wysyłek e-mail</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Wyślij dowolny typ maila do wybranego partnera
          </p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              Nowa wiadomość
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Partner select */}
            <div className="space-y-2">
              <Label>Partner</Label>
              <Select value={selectedPartnerId} onValueChange={handlePartnerChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz partnera..." />
                </SelectTrigger>
                <SelectContent>
                  {partners.filter((p) => p.email).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name} ({p.email})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Email type grid */}
            <div className="space-y-2">
              <Label>Typ wiadomości</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {emailTypeOptions.map((opt) => {
                  const disabled = opt.value === "onboard" && selectedPartner && isOnboardSent;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={!!disabled}
                      onClick={() => handleEmailTypeChange(opt.value)}
                      className={cn(
                        "relative rounded-lg border p-3 text-left transition-all text-sm",
                        emailType === opt.value
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border hover:border-primary/40",
                        disabled && "opacity-40 cursor-not-allowed"
                      )}
                    >
                      <span className="text-lg">{opt.icon}</span>
                      <p className="font-medium mt-1">{opt.label}</p>
                      <p className="text-xs text-muted-foreground">{opt.description}</p>
                      {disabled && (
                        <span className="absolute top-1 right-1 text-[10px] text-green-600 font-medium">już wysłany ✓</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Onboard: password */}
            {emailType === "onboard" && selectedPartner && (
              <div className="space-y-2">
                <Label>Hasło agenta {selectedPartner.agent_user_id ? "(reset)" : "(nowe konto)"}</Label>
                <Input
                  value={onboardPassword}
                  onChange={(e) => setOnboardPassword(e.target.value)}
                  placeholder="Wygenerowane automatycznie"
                />
                <p className="text-xs text-muted-foreground">
                  {selectedPartner.agent_user_id
                    ? "Hasło zostanie zresetowane przed wysyłką."
                    : "Konto agenta zostanie utworzone automatycznie."}
                </p>
              </div>
            )}

            {/* Project select (optional, for onboard/general) */}
            {(emailType === "onboard" || emailType === "general") && (
              <div className="space-y-2">
                <Label>Projekt (opcjonalnie)</Label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Brak — wszystkie przypisane" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Brak</SelectItem>
                    {projects.map((pr) => (
                      <SelectItem key={pr.id} value={pr.id}>{pr.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Custom message */}
            {(emailType === "follow_up" || emailType === "proposal" || emailType === "question") && (
              <div className="space-y-2">
                <Label>
                  Treść wiadomości {(emailType === "proposal" || emailType === "question") && <span className="text-destructive">*</span>}
                </Label>
                <Textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder="Wpisz treść..."
                  rows={4}
                />
              </div>
            )}

            {/* Send button */}
            <Button
              onClick={handleSend}
              disabled={sending || !canSend()}
              className="w-full gap-2"
              size="lg"
            >
              {sending ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Wysyłanie...</>
              ) : (
                <><Send className="h-4 w-4" /> Wyślij e-mail</>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
