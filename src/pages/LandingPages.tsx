import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  Plus,
  Pencil,
  Trash2,
  Sparkles,
  ExternalLink,
  LayoutTemplate,
  Upload,
  X,
  Eye,
  Loader2,
  Palette,
  Type,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { pl } from "date-fns/locale";

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
  bg_color?: string;
  text_color?: string;
  font_family?: string;
  hero_overlay_opacity?: number;
  hero_bg_type?: "image" | "color" | "gradient";
  theme?: string;
}

interface LandingPage {
  id: string;
  title: string;
  slug: string | null;
  description: string | null;
  ai_prompt: string | null;
  generated_content: LandingContent | null;
  hero_image_url: string | null;
  images: string[];
  is_published: boolean;
  created_at: string;
}

const emptyForm = {
  title: "",
  description: "",
  ai_prompt: "",
};

const DEFAULT_CONTENT: LandingContent = {
  accent_color: "#b8972c",
  bg_color: "#0f172a",
  text_color: "#ffffff",
  font_family: "Inter",
  hero_overlay_opacity: 60,
  hero_bg_type: "image",
  theme: "elegant",
};

const FONT_OPTIONS = [
  { value: "Inter", label: "Inter (modern sans)" },
  { value: "Playfair Display", label: "Playfair (elegant serif)" },
  { value: "Montserrat", label: "Montserrat (geometric)" },
  { value: "Poppins", label: "Poppins (friendly)" },
  { value: "Cormorant Garamond", label: "Cormorant (luxury serif)" },
];

const THEME_PRESETS: Record<string, { accent: string; bg: string; text: string }> = {
  elegant: { accent: "#b8972c", bg: "#0f172a", text: "#ffffff" },
  modern: { accent: "#3b82f6", bg: "#0a0a0a", text: "#ffffff" },
  minimal: { accent: "#171717", bg: "#fafafa", text: "#171717" },
  bold: { accent: "#dc2626", bg: "#1c1917", text: "#ffffff" },
  nature: { accent: "#16a34a", bg: "#0c1410", text: "#ffffff" },
};

export default function LandingPages() {
  const { role } = useAuth();
  const { toast } = useToast();
  const isAdmin = role === "admin";

  const [pages, setPages] = useState<LandingPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LandingPage | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [content, setContent] = useState<LandingContent>(DEFAULT_CONTENT);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchPages = async () => {
    const { data } = await supabase
      .from("landing_pages")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setPages(data as LandingPage[]);
    setLoading(false);
  };

  useEffect(() => { fetchPages(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setUploadedImages([]);
    setContent(DEFAULT_CONTENT);
    setOpen(true);
  };

  const openEdit = (p: LandingPage) => {
    setEditing(p);
    setForm({
      title: p.title,
      description: p.description ?? "",
      ai_prompt: p.ai_prompt ?? "",
    });
    setUploadedImages(p.images ?? []);
    setContent({ ...DEFAULT_CONTENT, ...(p.generated_content ?? {}) });
    setOpen(true);
  };

  const applyTheme = (theme: string) => {
    const preset = THEME_PRESETS[theme];
    if (preset) {
      setContent((c) => ({ ...c, theme, accent_color: preset.accent, bg_color: preset.bg, text_color: preset.text }));
    } else {
      setContent((c) => ({ ...c, theme }));
    }
  };

  const updateFeature = (idx: number, key: "title" | "description" | "icon", value: string) => {
    setContent((c) => {
      const features = [...(c.features ?? [])];
      features[idx] = { ...features[idx], [key]: value };
      return { ...c, features };
    });
  };

  const updateBenefit = (idx: number, value: string) => {
    setContent((c) => {
      const benefits = [...(c.benefits ?? [])];
      benefits[idx] = value;
      return { ...c, benefits };
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    const newUrls: string[] = [];
    for (const file of files) {
      const ext = file.name.split(".").pop();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage
        .from("landing-page-images")
        .upload(path, file, { upsert: true });
      if (!error) {
        const { data } = supabase.storage
          .from("landing-page-images")
          .getPublicUrl(path);
        newUrls.push(data.publicUrl);
      }
    }
    setUploadedImages((prev) => [...prev, ...newUrls]);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeImage = (url: string) => {
    setUploadedImages((prev) => prev.filter((u) => u !== url));
  };

  const handleGenerate = async () => {
    if (!form.title && !form.ai_prompt && !form.description) {
      toast({ title: "Uzupełnij tytuł lub prompt", variant: "destructive" });
      return;
    }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-landing-page", {
        body: {
          title: form.title,
          prompt: form.ai_prompt,
          description: form.description,
          images: uploadedImages,
        },
      });
      if (error || data?.error) {
        toast({
          title: "Błąd generowania",
          description: data?.error ?? error?.message,
          variant: "destructive",
        });
      } else {
        toast({ title: "Treść wygenerowana — możesz teraz dostosować kolory i teksty" });
        // Merge AI content into current visual settings
        setContent((c) => ({ ...c, ...(data.content as LandingContent) }));
      }
    } catch {
      toast({ title: "Błąd", description: "Nie udało się wygenerować treści", variant: "destructive" });
    }
    setGenerating(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);

    const payload = {
      title: form.title,
      description: form.description || null,
      ai_prompt: form.ai_prompt || null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      generated_content: content as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      images: uploadedImages as any,
      hero_image_url: uploadedImages[0] ?? null,
    };

    if (editing) {
      const { error } = await supabase.from("landing_pages").update(payload).eq("id", editing.id);
      if (error) toast({ title: "Błąd", description: error.message, variant: "destructive" });
      else toast({ title: "Landing page zaktualizowany" });
    } else {
      const { error } = await supabase.from("landing_pages").insert([payload]);
      if (error) toast({ title: "Błąd", description: error.message, variant: "destructive" });
      else toast({ title: "Landing page utworzony!" });
    }

    setSaving(false);
    setOpen(false);
    fetchPages();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("landing_pages").delete().eq("id", deleteTarget);
    if (error) toast({ title: "Błąd", description: error.message, variant: "destructive" });
    else toast({ title: "Landing page usunięty" });
    setDeleteTarget(null);
    fetchPages();
  };

  const togglePublished = async (p: LandingPage) => {
    await supabase.from("landing_pages").update({ is_published: !p.is_published }).eq("id", p.id);
    fetchPages();
  };

  const previewUrl = (p: LandingPage) => `${window.location.origin}/lp/${p.slug ?? p.id}`;

  return (
    <AppShell>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Landing Pages</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Twórz strony docelowe z formularzem kontaktowym</p>
          </div>
          {isAdmin && (
            <Button onClick={openCreate} className="gap-2">
              <Plus className="h-4 w-4" /> Nowy landing page
            </Button>
          )}
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Ładowanie...</div>
            ) : pages.length === 0 ? (
              <div className="p-12 text-center">
                <LayoutTemplate className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground">Brak landing pages</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Utwórz pierwszy landing page z formularzem kontaktowym
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tytuł</TableHead>
                      <TableHead>URL (slug)</TableHead>
                      <TableHead>Zdjęcia</TableHead>
                      <TableHead>AI</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Akcje</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pages.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.title}</TableCell>
                        <TableCell>
                          <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                            /lp/{p.slug ?? p.id}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {p.images?.length ?? 0} zdjęć
                        </TableCell>
                        <TableCell>
                          {p.generated_content ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 text-xs font-medium">
                              <Sparkles className="h-3 w-3" /> Wygenerowany
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
                              p.is_published
                                ? "bg-green-50 text-green-700 border-green-200"
                                : "bg-muted text-muted-foreground border-border"
                            }`}
                          >
                            {p.is_published ? "Opublikowany" : "Ukryty"}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(p.created_at), "d MMM yyyy", { locale: pl })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              title="Podgląd"
                              onClick={() => window.open(previewUrl(p), "_blank")}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              title="Kopiuj link"
                              onClick={() => {
                                navigator.clipboard.writeText(previewUrl(p));
                                toast({ title: "Link skopiowany!" });
                              }}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                            {isAdmin && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => openEdit(p)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 px-2 text-xs"
                                  onClick={() => togglePublished(p)}
                                >
                                  {p.is_published ? "Ukryj" : "Opublikuj"}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                  onClick={() => setDeleteTarget(p.id)}
                                >
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

        {/* Create/Edit Dialog */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editing ? "Edytuj landing page" : "Nowy landing page"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-5">
              {/* Title */}
              <div className="space-y-2">
                <Label>Tytuł strony *</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="np. Apartament Centrum Prestige"
                  required
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label>Opis oferty</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Opisz nieruchomość: lokalizacja, metraż, udogodnienia..."
                  rows={3}
                />
              </div>

              {/* AI Prompt */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                  Prompt AI (opcjonalnie)
                </Label>
                <Textarea
                  value={form.ai_prompt}
                  onChange={(e) => setForm({ ...form, ai_prompt: e.target.value })}
                  placeholder="np. Stwórz elegancką stronę dla luksusowego apartamentu w centrum Warszawy, podkreśl widok na miasto i bliskość parku..."
                  rows={3}
                />
              </div>

              {/* Image Upload */}
              <div className="space-y-3">
                <Label>Zdjęcia</Label>
                <div
                  className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => fileRef.current?.click()}
                >
                  {uploading ? (
                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Przesyłanie...
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="h-6 w-6 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Kliknij aby dodać zdjęcia (JPG, PNG, WebP)
                      </p>
                    </div>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                </div>

                {uploadedImages.length > 0 && (
                  <div className="grid grid-cols-4 gap-2">
                    {uploadedImages.map((url, i) => (
                      <div key={i} className="relative group">
                        <img
                          src={url}
                          alt={`Zdjęcie ${i + 1}`}
                          className="w-full aspect-square object-cover rounded-lg border"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(url)}
                          className="absolute top-1 right-1 h-5 w-5 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3 w-3" />
                        </button>
                        {i === 0 && (
                          <span className="absolute bottom-1 left-1 rounded bg-black/60 text-white text-[10px] px-1">
                            Główne
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Generate button */}
              <div className="rounded-lg border bg-purple-50/50 p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <Sparkles className="h-4 w-4 text-purple-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Generuj treść AI</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      AI stworzy nagłówki, opisy i strukturę landing page na podstawie Twoich danych
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2 border-purple-200 hover:bg-purple-50"
                  onClick={handleGenerate}
                  disabled={generating}
                >
                  {generating ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Generowanie...</>
                  ) : (
                    <><Sparkles className="h-4 w-4 text-purple-500" /> Generuj z AI</>
                  )}
                </Button>
              </div>

              {/* Visual customization panel */}
              <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <Palette className="h-4 w-4 text-foreground" />
                  <p className="text-sm font-medium text-foreground">Wygląd i kolory</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Szybki motyw</Label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(THEME_PRESETS).map(([key, preset]) => (
                      <button key={key} type="button" onClick={() => applyTheme(key)}
                        className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs capitalize transition ${content.theme === key ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/50"}`}>
                        <span className="h-3 w-3 rounded-full" style={{ background: preset.accent }} />{key}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {([["Akcent","accent_color","#b8972c"],["Tło","bg_color","#0f172a"],["Tekst","text_color","#ffffff"]] as const).map(([label,key,def]) => (
                    <div key={key} className="space-y-1">
                      <Label className="text-xs">{label}</Label>
                      <div className="flex items-center gap-1.5">
                        <input type="color" value={(content[key] as string) || def} onChange={(e) => setContent({ ...content, [key]: e.target.value })} className="h-8 w-10 cursor-pointer rounded border border-border" />
                        <Input value={(content[key] as string) || ""} onChange={(e) => setContent({ ...content, [key]: e.target.value })} className="h-8 text-xs font-mono" />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs flex items-center gap-1"><Type className="h-3 w-3" /> Czcionka</Label>
                    <Select value={content.font_family || "Inter"} onValueChange={(v) => setContent({ ...content, font_family: v })}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FONT_OPTIONS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Tło hero</Label>
                    <Select value={content.hero_bg_type || "image"} onValueChange={(v) => setContent({ ...content, hero_bg_type: v as "image"|"color"|"gradient" })}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="image">Zdjęcie</SelectItem>
                        <SelectItem value="color">Kolor jednolity</SelectItem>
                        <SelectItem value="gradient">Gradient</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {content.hero_bg_type !== "color" && (
                  <div className="space-y-2">
                    <Label className="text-xs">Przyciemnienie hero ({content.hero_overlay_opacity ?? 60}%)</Label>
                    <Slider value={[content.hero_overlay_opacity ?? 60]} onValueChange={([v]) => setContent({ ...content, hero_overlay_opacity: v })} min={0} max={90} step={5} />
                  </div>
                )}
              </div>

              {(content.headline || (content.features && content.features.length > 0)) && (
                <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                  <p className="text-sm font-medium text-foreground">Edycja tekstów</p>
                  <div className="space-y-1"><Label className="text-xs">Nagłówek</Label><Input value={content.headline || ""} onChange={(e) => setContent({ ...content, headline: e.target.value })} /></div>
                  <div className="space-y-1"><Label className="text-xs">Podtytuł</Label><Input value={content.subheadline || ""} onChange={(e) => setContent({ ...content, subheadline: e.target.value })} /></div>
                  <div className="space-y-1"><Label className="text-xs">Opis</Label><Textarea value={content.description || ""} onChange={(e) => setContent({ ...content, description: e.target.value })} rows={3} /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1"><Label className="text-xs">Tekst CTA</Label><Input value={content.cta_text || ""} onChange={(e) => setContent({ ...content, cta_text: e.target.value })} /></div>
                    <div className="space-y-1"><Label className="text-xs">Tytuł formularza</Label><Input value={content.contact_title || ""} onChange={(e) => setContent({ ...content, contact_title: e.target.value })} /></div>
                  </div>
                  {content.benefits && content.benefits.length > 0 && (
                    <div className="space-y-1">
                      <Label className="text-xs">Benefity</Label>
                      {content.benefits.map((b, i) => <Input key={i} value={b} onChange={(e) => updateBenefit(i, e.target.value)} className="h-8 text-xs" />)}
                    </div>
                  )}
                  {content.features && content.features.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-xs">Cechy</Label>
                      {content.features.map((f, i) => (
                        <div key={i} className="grid grid-cols-2 gap-1.5 rounded border border-border p-2">
                          <Input value={f.title} onChange={(e) => updateFeature(i, "title", e.target.value)} placeholder="Tytuł" className="h-8 text-xs" />
                          <Input value={f.icon} onChange={(e) => updateFeature(i, "icon", e.target.value)} placeholder="ikona" className="h-8 text-xs" />
                          <Textarea value={f.description} onChange={(e) => updateFeature(i, "description", e.target.value)} rows={2} className="col-span-2 text-xs" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Anuluj
                </Button>
                <Button type="submit" disabled={saving || !form.title.trim()}>
                  {saving ? "Zapisywanie..." : "Zapisz"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete confirmation */}
        <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Usuń landing page</AlertDialogTitle>
              <AlertDialogDescription>
                Czy na pewno chcesz usunąć ten landing page? Powiązane linki afiliacyjne stracą do niego dostęp.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Anuluj</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
                Usuń
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppShell>
  );
}
