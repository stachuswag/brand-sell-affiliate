import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, ArrowLeft, UserX, Lock, ShieldCheck } from "lucide-react";
import logo from "@/assets/logo.webp";
import { useToast } from "@/hooks/use-toast";

interface Partner {
  id: string;
  name: string;
  email: string | null;
  agent_user_id: string | null;
}

type Step = "select" | "login" | "no-account" | "admin-login";

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [partners, setPartners] = useState<Partner[]>([]);
  const [loadingPartners, setLoadingPartners] = useState(true);
  const [step, setStep] = useState<Step>("select");
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase
      .from("partners")
      .select("id, name, email, agent_user_id")
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => {
        if (data) setPartners(data as Partner[]);
        setLoadingPartners(false);
      });
  }, []);

  const handleSelectPartner = (p: Partner) => {
    setSelectedPartner(p);
    if (!p.agent_user_id) {
      setStep("no-account");
    } else {
      setEmail(p.email ?? "");
      setPassword("");
      setShowPass(false);
      setStep("login");
    }
  };

  const handleBack = () => {
    setStep("select");
    setSelectedPartner(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      toast({
        title: "Błąd logowania",
        description: "Nieprawidłowy email lub hasło.",
        variant: "destructive",
      });
    } else {
      setTimeout(() => {
        if (step === "admin-login") {
          navigate("/dashboard");
        } else {
          navigate("/agent");
        }
      }, 300);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="flex flex-col items-center mb-10">
          <img src={logo} alt="Brand and Sell" className="h-24 w-auto object-contain mb-4" />
          <p className="text-sm text-muted-foreground mt-1">
            {step === "admin-login" ? "Panel Administratora" : "Panel Agenta"}
          </p>
        </div>

        {/* Step: select partner */}
        {step === "select" && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-foreground">Wybierz swojego partnera</h2>
              <p className="text-sm text-muted-foreground mt-1">Kliknij na swój bloczek aby się zalogować</p>
            </div>

            {loadingPartners ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />
                ))}
              </div>
            ) : partners.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                Brak aktywnych partnerów
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {partners.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleSelectPartner(p)}
                    className={`
                      relative group rounded-xl border-2 p-5 text-left transition-all duration-150
                      hover:shadow-md hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
                      ${p.agent_user_id
                        ? "bg-card border-border hover:border-primary/60"
                        : "bg-muted/40 border-border/50 hover:border-border opacity-75"
                      }
                    `}
                  >
                    <div className="flex flex-col gap-2 h-full">
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center text-lg font-bold ${p.agent_user_id ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-foreground leading-tight">{p.name}</p>
                        <p className={`text-xs mt-0.5 ${p.agent_user_id ? "text-green-600" : "text-muted-foreground"}`}>
                          {p.agent_user_id ? "Konto aktywne" : "Brak konta"}
                        </p>
                      </div>
                    </div>
                    {p.agent_user_id && (
                      <div className="absolute top-3 right-3 h-2 w-2 rounded-full bg-success" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Admin login button — always shown on select step */}
        {step === "select" && (
          <div className="mt-8 text-center">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-3 text-muted-foreground tracking-wider">lub</span>
              </div>
            </div>
            <button
              onClick={() => {
                setEmail("");
                setPassword("");
                setShowPass(false);
                setStep("admin-login");
              }}
              className="mt-5 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors border border-border rounded-lg px-4 py-2.5 hover:bg-muted/50"
            >
              <ShieldCheck className="h-4 w-4" />
              Zaloguj się jako Administrator
            </button>
          </div>
        )}

        {/* Step: no account */}
        {step === "no-account" && selectedPartner && (
          <div className="max-w-md mx-auto">
            <button
              onClick={handleBack}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Wróć do wyboru partnera
            </button>
            <div className="bg-card border border-border rounded-2xl p-8 text-center space-y-4 shadow-sm">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto">
                <UserX className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">{selectedPartner.name}</h2>
                <p className="text-sm text-muted-foreground mt-2">
                  Konto agenta dla tego partnera nie zostało jeszcze utworzone.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Skontaktuj się z administratorem systemu w celu utworzenia konta.
                </p>
              </div>
              <Button variant="outline" onClick={handleBack} className="w-full">
                <ArrowLeft className="h-4 w-4 mr-2" /> Wróć
              </Button>
            </div>
          </div>
        )}

        {/* Step: login form */}
        {step === "login" && selectedPartner && (
          <div className="max-w-md mx-auto">
            <button
              onClick={handleBack}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Wróć do wyboru partnera
            </button>
            <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
              {/* Partner header */}
              <div className="bg-primary/5 border-b border-border px-6 py-5 flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-xl font-bold flex-shrink-0">
                  {selectedPartner.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Logowanie jako</p>
                  <p className="font-bold text-foreground text-lg leading-tight">{selectedPartner.name}</p>
                </div>
                <div className="ml-auto">
                  <Lock className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email (login)</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="agent@firma.pl"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Hasło</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPass ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Logowanie..." : "Zaloguj się"}
                </Button>
              </form>
            </div>
          </div>
        )}

        {/* Step: admin login */}
        {step === "admin-login" && (
          <div className="max-w-md mx-auto">
            <button
              onClick={handleBack}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Wróć
            </button>
            <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
              {/* Admin header */}
              <div className="bg-primary/5 border-b border-border px-6 py-5 flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Logowanie do</p>
                  <p className="font-bold text-foreground text-lg leading-tight">Panelu Głównego</p>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="admin-email">Email</Label>
                  <Input
                    id="admin-email"
                    type="email"
                    placeholder="admin@brandsell.pl"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-password">Hasło</Label>
                  <div className="relative">
                    <Input
                      id="admin-password"
                      type={showPass ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Logowanie..." : "Zaloguj się"}
                </Button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
