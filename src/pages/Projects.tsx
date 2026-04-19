import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, MapPin, FolderOpen, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Project {
  id: string;
  name: string;
  cities: string[];
  description: string | null;
  is_active: boolean;
  materials_folder_url: string | null;
  created_at: string;
  partner_count?: number;
}

interface Partner { id: string; name: string; }

const emptyForm = {
  name: "",
  cities: "",
  description: "",
  materials_folder_url: "",
  is_active: true,
};

export default function Projects() {
  const { role } = useAuth();
  const { toast } = useToast();
  const isAdmin = role === "admin";

  const [projects, setProjects] = useState<Project[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [selectedPartnerIds, setSelectedPartnerIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchAll = async () => {
    const [{ data: projectsData }, { data: partnersData }, { data: pp }] = await Promise.all([
      supabase.from("projects").select("*").order("name"),
      supabase.from("partners").select("id, name").eq("is_active", true).order("name"),
      supabase.from("partner_projects").select("project_id"),
    ]);
    if (partnersData) setPartners(partnersData as Partner[]);
    if (projectsData) {
      const counts: Record<string, number> = {};
      pp?.forEach((row) => { counts[row.project_id] = (counts[row.project_id] ?? 0) + 1; });
      setProjects((projectsData as Project[]).map((p) => ({ ...p, partner_count: counts[p.id] ?? 0 })));
    }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setSelectedPartnerIds([]);
    setDialogOpen(true);
  };

  const openEdit = async (p: Project) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      cities: p.cities.join(", "),
      description: p.description || "",
      materials_folder_url: p.materials_folder_url || "",
      is_active: p.is_active,
    });
    const { data } = await supabase
      .from("partner_projects")
      .select("partner_id")
      .eq("project_id", p.id);
    setSelectedPartnerIds(data?.map((r) => r.partner_id) ?? []);
    setDialogOpen(true);
  };

  const togglePartner = (id: string) => {
    setSelectedPartnerIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const payload = {
      name: form.name,
      cities: form.cities.split(",").map(c => c.trim()).filter(Boolean),
      description: form.description || null,
      materials_folder_url: form.materials_folder_url || null,
      is_active: form.is_active,
    };

    let projectId = editingId;
    if (editingId) {
      const { error } = await supabase.from("projects").update(payload).eq("id", editingId);
      if (error) { toast({ title: "Błąd", description: error.message, variant: "destructive" }); setSaving(false); return; }
      toast({ title: "Projekt zaktualizowany" });
    } else {
      const { data, error } = await supabase.from("projects").insert(payload).select("id").single();
      if (error) { toast({ title: "Błąd", description: error.message, variant: "destructive" }); setSaving(false); return; }
      projectId = data.id;
      toast({ title: "Projekt dodany" });
    }

    if (projectId) {
      await supabase.from("partner_projects").delete().eq("project_id", projectId);
      if (selectedPartnerIds.length > 0) {
        await supabase.from("partner_projects").insert(
          selectedPartnerIds.map((pid) => ({ project_id: projectId!, partner_id: pid }))
        );
      }
    }

    setDialogOpen(false);
    setSaving(false);
    fetchAll();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from("partner_projects").delete().eq("project_id", deleteId);
    const { error } = await supabase.from("projects").delete().eq("id", deleteId);
    if (error) toast({ title: "Błąd", description: error.message, variant: "destructive" });
    else toast({ title: "Projekt usunięty" });
    setDeleteId(null);
    fetchAll();
  };

  const toggleActive = async (p: Project) => {
    await supabase.from("projects").update({ is_active: !p.is_active }).eq("id", p.id);
    fetchAll();
  };

  return (
    <AppShell>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Projekty inwestycyjne</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Zarządzaj inwestycjami, miastami i przypisanymi partnerami
            </p>
          </div>
          {isAdmin && (
            <Button onClick={openCreate} className="gap-1.5">
              <Plus className="h-4 w-4" /> Nowy projekt
            </Button>
          )}
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Ładowanie...</div>
            ) : projects.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Brak projektów. Dodaj pierwszy projekt inwestycyjny.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nazwa</TableHead>
                      <TableHead>Miasta</TableHead>
                      <TableHead className="text-center">Partnerzy</TableHead>
                      <TableHead>Opis</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      {isAdmin && <TableHead className="text-right">Akcje</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projects.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {p.cities.map((city) => (
                              <Badge key={city} variant="secondary" className="text-xs gap-1">
                                <MapPin className="h-2.5 w-2.5" /> {city}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="gap-1">
                            <Users className="h-3 w-3" /> {p.partner_count ?? 0}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                          {p.description || "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={p.is_active ? "default" : "secondary"}
                            className="cursor-pointer"
                            onClick={() => isAdmin && toggleActive(p)}
                          >
                            {p.is_active ? "Aktywny" : "Nieaktywny"}
                          </Badge>
                        </TableCell>
                        {isAdmin && (
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {p.materials_folder_url && (
                                <Button
                                  variant="ghost" size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => window.open(p.materials_folder_url!, "_blank")}
                                  title="Folder materiałów"
                                >
                                  <FolderOpen className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(p)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost" size="sm"
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                onClick={() => setDeleteId(p.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edytuj projekt" : "Nowy projekt"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <Label>Nazwa projektu</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="np. Kownatki"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Miasta (oddzielone przecinkami)</Label>
                <Input
                  value={form.cities}
                  onChange={(e) => setForm({ ...form, cities: e.target.value })}
                  placeholder="Warszawa, Poznań, Trójmiasto"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Opis</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Krótki opis inwestycji..."
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Link do folderu materiałów (Google Drive)</Label>
                <Input
                  value={form.materials_folder_url}
                  onChange={(e) => setForm({ ...form, materials_folder_url: e.target.value })}
                  placeholder="https://drive.google.com/drive/folders/..."
                />
              </div>

              <div className="space-y-2">
                <Label>Przypisani partnerzy ({selectedPartnerIds.length})</Label>
                <div className="border border-border rounded-md max-h-48 overflow-y-auto p-2 space-y-1">
                  {partners.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-2">Brak aktywnych partnerów</p>
                  ) : partners.map((p) => (
                    <label
                      key={p.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm"
                    >
                      <Checkbox
                        checked={selectedPartnerIds.includes(p.id)}
                        onCheckedChange={() => togglePartner(p.id)}
                      />
                      <span>{p.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Anuluj</Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Zapisywanie..." : editingId ? "Zapisz" : "Dodaj"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Usunąć projekt?</AlertDialogTitle>
              <AlertDialogDescription>
                Ta operacja jest nieodwracalna. Projekt zostanie trwale usunięty.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Anuluj</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                Usuń
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppShell>
  );
}
