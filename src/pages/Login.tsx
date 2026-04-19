import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import logo from "@/assets/logo.webp";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const { signIn, user, role } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [justSignedIn, setJustSignedIn] = useState(false);

  // Redirect after login when role becomes available
  useEffect(() => {
    if (!justSignedIn || !user) return;
    if (role === null) return; // wait for role
    if (role === "agent") {
      navigate("/agent", { replace: true });
    } else {
      navigate("/dashboard", { replace: true });
    }
  }, [justSignedIn, user, role, navigate]);

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
      return;
    }
    setJustSignedIn(true);
    // Fallback: lookup role directly in case context delays
    setTimeout(async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) return;
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", u.id)
        .maybeSingle();
      if (roleRow?.role === "agent") navigate("/agent", { replace: true });
      else navigate("/dashboard", { replace: true });
    }, 600);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-10">
      <button
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        className="fixed top-4 right-4 h-9 w-9 flex items-center justify-center rounded-full border border-border bg-card hover:bg-muted transition-colors shadow-sm"
        title={theme === "dark" ? "Tryb jasny" : "Tryb ciemny"}
      >
        {theme === "dark" ? <Sun className="h-4 w-4 text-foreground" /> : <Moon className="h-4 w-4 text-foreground" />}
      </button>

      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="rounded-2xl bg-primary p-4 mb-4 shadow-lg">
            <img src={logo} alt="Brand and Sell" className="h-20 w-auto object-contain" />
          </div>
          <p className="text-sm text-muted-foreground mt-1">Zaloguj się do panelu</p>
        </div>

        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="twoj@email.pl"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
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
            <p className="text-xs text-muted-foreground text-center pt-2">
              Po zalogowaniu zostaniesz przekierowany do swojego panelu.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
