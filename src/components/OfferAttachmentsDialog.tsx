import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  FileText,
  Link2,
  Upload,
  Trash2,
  ExternalLink,
  Download,
  Plus,
  Loader2,
} from "lucide-react";

interface Attachment {
  id: string;
  attachment_type: string;
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  file_type: string | null;
  link_url: string | null;
  link_title: string | null;
  created_at: string;
}

interface OfferAttachmentsDialogProps {
  offer: { id: string; name: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  readOnly?: boolean;
}

function formatSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function OfferAttachmentsDialog({
  offer,
  open,
  onOpenChange,
  readOnly = false,
}: OfferAttachmentsDialogProps) {
  const { role } = useAuth();
  const { toast } = useToast();
  const isAdmin = role === "admin";
  const canManage = isAdmin && !readOnly;

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [addingLink, setAddingLink] = useState(false);
  const [linkForm, setLinkForm] = useState({ url: "", title: "" });
  const [showLinkForm, setShowLinkForm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && offer) {
      fetchAttachments();
    }
  }, [open, offer]);

  const fetchAttachments = async () => {
    if (!offer) return;
    setLoading(true);
    const { data } = await supabase
      .from("offer_attachments")
      .select("*")
      .eq("offer_id", offer.id)
      .order("created_at", { ascending: false });
    setAttachments((data as Attachment[]) ?? []);
    setLoading(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !offer) return;
    setUploading(true);

    for (const file of Array.from(files)) {
      const path = `${offer.id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("offer-files")
        .upload(path, file);

      if (uploadError) {
        toast({ title: "Błąd uploadu", description: uploadError.message, variant: "destructive" });
        continue;
      }

      const { data: urlData } = supabase.storage.from("offer-files").getPublicUrl(path);

      await supabase.from("offer_attachments").insert({
        offer_id: offer.id,
        attachment_type: "file",
        file_url: urlData.publicUrl,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
      });
    }

    toast({ title: "Pliki dodane" });
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    fetchAttachments();
  };

  const handleAddLink = async () => {
    if (!linkForm.url || !offer) return;
    setAddingLink(true);

    const { error } = await supabase.from("offer_attachments").insert({
      offer_id: offer.id,
      attachment_type: "link",
      link_url: linkForm.url,
      link_title: linkForm.title || linkForm.url,
    });

    if (error) {
      toast({ title: "Błąd", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Link dodany" });
      setLinkForm({ url: "", title: "" });
      setShowLinkForm(false);
      fetchAttachments();
    }
    setAddingLink(false);
  };

  const handleDelete = async (att: Attachment) => {
    if (att.attachment_type === "file" && att.file_url) {
      const path = att.file_url.split("/offer-files/")[1];
      if (path) {
        await supabase.storage.from("offer-files").remove([decodeURIComponent(path)]);
      }
    }
    await supabase.from("offer_attachments").delete().eq("id", att.id);
    toast({ title: "Usunięto" });
    fetchAttachments();
  };

  const files = attachments.filter((a) => a.attachment_type === "file");
  const links = attachments.filter((a) => a.attachment_type === "link");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Pliki i linki — {offer?.name}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="files" className="flex-1 min-h-0">
          <TabsList className="w-full">
            <TabsTrigger value="files" className="flex-1 gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Pliki ({files.length})
            </TabsTrigger>
            <TabsTrigger value="links" className="flex-1 gap-1.5">
              <Link2 className="h-3.5 w-3.5" /> Linki ({links.length})
            </TabsTrigger>
          </TabsList>

          {/* FILES TAB */}
          <TabsContent value="files" className="space-y-3 mt-3">
            {canManage && (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="gap-2"
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {uploading ? "Wgrywanie..." : "Dodaj pliki"}
                </Button>
              </div>
            )}

            {loading ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Ładowanie...</p>
            ) : files.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Brak plików</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {files.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2"
                  >
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{f.file_name}</p>
                      <p className="text-xs text-muted-foreground">{formatSize(f.file_size)}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => window.open(f.file_url!, "_blank")}
                        title="Pobierz"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      {canManage && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(f)}
                          title="Usuń"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* LINKS TAB */}
          <TabsContent value="links" className="space-y-3 mt-3">
            {canManage && (
              <div>
                {showLinkForm ? (
                  <div className="space-y-2 rounded-lg border border-border p-3">
                    <div className="space-y-1">
                      <Label className="text-xs">URL *</Label>
                      <Input
                        value={linkForm.url}
                        onChange={(e) => setLinkForm({ ...linkForm, url: e.target.value })}
                        placeholder="https://..."
                        type="url"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Tytuł (opcjonalnie)</Label>
                      <Input
                        value={linkForm.title}
                        onChange={(e) => setLinkForm({ ...linkForm, title: e.target.value })}
                        placeholder="np. Mapa lokalizacji"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleAddLink} disabled={addingLink || !linkForm.url}>
                        {addingLink ? "Dodawanie..." : "Dodaj"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setShowLinkForm(false); setLinkForm({ url: "", title: "" }); }}>
                        Anuluj
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowLinkForm(true)}
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" /> Dodaj link
                  </Button>
                )}
              </div>
            )}

            {loading ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Ładowanie...</p>
            ) : links.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Brak linków</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {links.map((l) => (
                  <div
                    key={l.id}
                    className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2"
                  >
                    <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{l.link_title}</p>
                      <p className="text-xs text-muted-foreground truncate">{l.link_url}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => window.open(l.link_url!, "_blank")}
                        title="Otwórz"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                      {canManage && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(l)}
                          title="Usuń"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
