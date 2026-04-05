import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
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
import { Plus, KeyRound, Trash2, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Partner {
  id: string;
  name: string;
  email: string | null;
  login_email: string | null;
  is_active: boolean;
  agent_user_id: string | null;
}

function randomPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#";
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export default function Agents() {
  const { toast } = useToast();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);

  // Create dialog
  const [open, setOpen] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [form, setForm] = useState({ email: "", password: "" });
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Reset password dialog
  const [resetOpen, setResetOpen] = useState(false);
  const [resetPartner, setResetPartner] = useState<Partner | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  const fetchPartners = async () => {
    const { data } = await supabase
      .from("partners")
      .select("id, name, email, login_email, is_active, agent_user_id")
      .order("name");
    if (data) setPartners(data as Partner[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchPartners();
  }, []);

  const openCreate = (p: Partner) => {
    setSelectedPartner(p);
    setForm({ email: p.login_email ?? p.email ?? "", password: randomPassword() });
    setShowPassword(false);
    setOpen(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPartner || !form.email || !form.password) return;
    setSaving(true);

    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-agent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`,
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          action: "create",
          partner_id: selectedPartner.id,
          partner_name: selectedPartner.name,
          email: form.email,
          password: form.password,
        }),
      }
    );

    const result = await res.json();
    if (!res.ok || result.error) {
      toast({ title: "Błąd", description: result.error ?? "Nieznany błąd", variant: "destructive" });
    } else {
      toast({ title: "Konto agenta utworzone!", description: `Login: ${form.email} | Hasło: ${form.password}` });
      setOpen(false);
      fetchPartners();
    }
    setSaving(false);
  };

  const openReset = (p: Partner) => {
    setResetPartner(p);
    setNewPassword(randomPassword());
    setResetOpen(true);
  };

  const handleReset = async () => {
    if (!resetPartner?.agent_user_id) return;
    setResetting(true);

    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-agent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`,
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          action: "reset_password",
          user_id: resetPartner.agent_user_id,
          password: newPassword,
        }),
      }
    );

    const result = await res.json();
    if (!res.ok || result.error) {
      toast({ title: "Błąd", description: result.error, variant: "destructive" });
    } else {
      toast({ title: "Hasło zmienione!", description: `Nowe hasło: ${newPassword}` });
      setResetOpen(false);
    }
    setResetting(false);
  };

  const handleDelete = async (p: Partner) => {
    if (!p.agent_user_id) return;
    if (!confirm(`Usunąć konto agenta dla ${p.name}?`)) return;

    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-agent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`,
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          action: "delete",
          user_id: p.agent_user_id,
        }),
      }
    );

    const result = await res.json();
    if (!res.ok || result.error) {
      toast({ title: "Błąd", description: result.error, variant: "destructive" });
    } else {
      // Remove agent_user_id from partner
      await supabase.from("partners").update({ agent_user_id: null }).eq("id", p.id);
      toast({ title: "Konto usunięte" });
      fetchPartners();
    }
  };

  return (
    <AppShell>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Konta agentów</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Zarządzaj dostępem partnerów do ich panelu agenta
          </p>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Ładowanie...</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Partner</TableHead>
                      <TableHead>Email logowania</TableHead>
                      <TableHead className="text-center">Konto agenta</TableHead>
                      <TableHead className="text-right">Akcje</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {partners.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {p.login_email ?? p.email ?? "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${p.agent_user_id ? "bg-green-50 text-green-700 border-green-200" : "bg-muted text-muted-foreground border-border"}`}>
                            {p.agent_user_id ? "Aktywne" : "Brak konta"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {!p.agent_user_id ? (
                              <Button variant="outline" size="sm" onClick={() => openCreate(p)} className="gap-1.5 h-8 text-xs">
                                <Plus className="h-3.5 w-3.5" /> Utwórz konto
                              </Button>
                            ) : (
                              <>
                                <Button variant="ghost" size="sm" onClick={() => openReset(p)} className="h-8 w-8 p-0" title="Zmień hasło">
                                  <KeyRound className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleDelete(p)} className="h-8 w-8 p-0 text-destructive hover:text-destructive" title="Usuń konto">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
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

        {/* Create Dialog */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Utwórz konto agenta — {selectedPartner?.name}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label>Email (login)</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="agent@firma.pl"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Hasło</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1 h-7 w-7 p-0"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Zapamiętaj lub zapisz hasło — agent będzie logować się na /login używając tego emaila i hasła.
                </p>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Anuluj</Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Tworzenie..." : "Utwórz konto"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Reset Password Dialog */}
        <Dialog open={resetOpen} onOpenChange={setResetOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Zmień hasło — {resetPartner?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nowe hasło</Label>
                <Input
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setResetOpen(false)}>Anuluj</Button>
                <Button onClick={handleReset} disabled={resetting}>
                  {resetting ? "Zapisywanie..." : "Zmień hasło"}
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
