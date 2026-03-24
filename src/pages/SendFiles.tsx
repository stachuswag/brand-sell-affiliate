import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Paperclip,
  Send,
  X,
  Link2,
  Users,
  FileText,
  CheckCircle2,
  Loader2,
  UploadCloud,
} from "lucide-react";
import { cn } from "@/lib/utils";

const WEBHOOK_URL = "https://hook.eu1.make.com/9i1o0n18arqc5um5v5aa3lq96en0nf6v";

interface Partner {
  id: string;
  name: string;
  email: string | null;
  contact_person: string | null;
  is_active: boolean;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SendFiles() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [partners, setPartners] = useState<Partner[]>([]);
  const [loadingPartners, setLoadingPartners] = useState(true);
  const [selectedPartners, setSelectedPartners] = useState<Set<string>>(new Set());
  const [files, setFiles] = useState<File[]>([]);
  const [link, setLink] = useState("");
  const [sending, setSending] = useState(false);
  const [sentPartners, setSentPartners] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    fetchPartners();
  }, []);

  async function fetchPartners() {
    setLoadingPartners(true);
    const { data } = await supabase
      .from("partners")
      .select("id, name, email, contact_person, is_active")
      .eq("is_active", true)
      .order("name");
    setPartners(data ?? []);
    setLoadingPartners(false);
  }

  function togglePartner(id: string) {
    setSelectedPartners((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    const withEmail = partners.filter((p) => p.email);
    if (selectedPartners.size === withEmail.length) {
      setSelectedPartners(new Set());
    } else {
      setSelectedPartners(new Set(withEmail.map((p) => p.id)));
    }
  }

  function addFiles(newFiles: FileList | null) {
    if (!newFiles) return;
    setFiles((prev) => [
      ...prev,
      ...Array.from(newFiles).filter(
        (f) => !prev.some((existing) => existing.name === f.name && existing.size === f.size)
      ),
    ]);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  }

  async function sendToPartner(partner: Partner): Promise<boolean> {
    const formData = new FormData();
    formData.append("email", partner.email ?? "");
    formData.append("partner_name", partner.name);
    if (partner.contact_person) formData.append("contact_person", partner.contact_person);
    if (link.trim()) formData.append("link", link.trim());
    formData.append("files_count", String(files.length));
    files.forEach((file, i) => {
      formData.append(`file_${i}`, file, file.name);
    });

    try {
      const res = await fetch(WEBHOOK_URL, { method: "POST", body: formData });
      return res.ok;
    } catch {
      return false;
    }
  }

  async function handleSend() {
    if (selectedPartners.size === 0) {
      toast({ title: "Wybierz partnerów", description: "Zaznacz co najmniej jednego partnera.", variant: "destructive" });
      return;
    }
    if (files.length === 0) {
      toast({ title: "Brak plików", description: "Dodaj co najmniej jeden plik do wysłania.", variant: "destructive" });
      return;
    }

    setSending(true);
    setSentPartners([]);

    const toSend = partners.filter((p) => selectedPartners.has(p.id) && p.email);
    const results: string[] = [];

    for (const partner of toSend) {
      const ok = await sendToPartner(partner);
      if (ok) results.push(partner.name);
    }

    setSentPartners(results);
    setSending(false);

    if (results.length === toSend.length) {
      toast({
        title: "Wysłano pomyślnie!",
        description: `Pliki wysłane do ${results.length} partnera(ów).`,
      });
      // Reset
      setFiles([]);
      setLink("");
      setSelectedPartners(new Set());
    } else {
      toast({
        title: "Częściowe powodzenie",
        description: `Wysłano do ${results.length} z ${toSend.length} partnerów.`,
        variant: "destructive",
      });
    }
  }

  const partnersWithEmail = partners.filter((p) => p.email);
  const allSelected = partnersWithEmail.length > 0 && selectedPartners.size === partnersWithEmail.length;

  return (
    <AppShell>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Wyślij pliki do partnerów</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Dołącz pliki i opcjonalny link, a następnie wybierz partnerów — każdy otrzyma osobną wiadomość.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Files + Link */}
          <div className="space-y-5">
            {/* File drop zone */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Paperclip className="h-4 w-4 text-primary" />
                  Pliki do wysłania
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Drop zone */}
                <div
                  className={cn(
                    "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
                    dragOver
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50 hover:bg-muted/30"
                  )}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                >
                  <UploadCloud className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm font-medium text-foreground">Kliknij lub przeciągnij pliki tutaj</p>
                  <p className="text-xs text-muted-foreground mt-1">PDF, Word, Excel, obrazy i inne</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => addFiles(e.target.files)}
                  />
                </div>

                {/* File list */}
                {files.length > 0 && (
                  <div className="space-y-2">
                    {files.map((file, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2"
                      >
                        <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{file.name}</p>
                          <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 flex-shrink-0"
                          onClick={() => removeFile(i)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Optional link */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-primary" />
                  Opcjonalny link
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  <Label htmlFor="link" className="text-xs text-muted-foreground">
                    Link (np. do oferty lub strony)
                  </Label>
                  <Input
                    id="link"
                    placeholder="https://..."
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: Partner selection */}
          <div className="space-y-5">
            <Card className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    Wybierz partnerów
                  </CardTitle>
                  {partnersWithEmail.length > 0 && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={toggleAll}>
                      {allSelected ? "Odznacz wszystkich" : "Zaznacz wszystkich"}
                    </Button>
                  )}
                </div>
                {selectedPartners.size > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {partners
                      .filter((p) => selectedPartners.has(p.id))
                      .map((p) => (
                        <Badge key={p.id} variant="secondary" className="text-xs gap-1">
                          {p.name}
                          <button onClick={() => togglePartner(p.id)} className="hover:text-destructive">
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </Badge>
                      ))}
                  </div>
                )}
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto max-h-80">
                {loadingPartners ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : partners.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-8">Brak aktywnych partnerów</p>
                ) : (
                  <div className="space-y-1">
                    {partners.map((partner) => {
                      const hasEmail = !!partner.email;
                      const checked = selectedPartners.has(partner.id);
                      return (
                        <label
                          key={partner.id}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2.5 cursor-pointer transition-colors",
                            hasEmail ? "hover:bg-muted/50" : "opacity-40 cursor-not-allowed",
                            checked && "bg-primary/5 border border-primary/20"
                          )}
                        >
                          <Checkbox
                            checked={checked}
                            disabled={!hasEmail}
                            onCheckedChange={() => hasEmail && togglePartner(partner.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{partner.name}</p>
                            {partner.email ? (
                              <p className="text-xs text-muted-foreground truncate">{partner.email}</p>
                            ) : (
                              <p className="text-xs text-destructive/70">Brak adresu e-mail</p>
                            )}
                          </div>
                          {checked && <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />}
                        </label>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Summary + Send */}
        <Card className={cn(
          "border transition-colors",
          files.length > 0 && selectedPartners.size > 0 ? "border-primary/30 bg-primary/5" : ""
        )}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">
                  Podsumowanie wysyłki
                </p>
                <p className="text-xs text-muted-foreground">
                  {files.length === 0 && selectedPartners.size === 0 && "Wybierz pliki i partnerów aby wysłać"}
                  {files.length > 0 && selectedPartners.size === 0 && `${files.length} plik(i) gotowe — wybierz partnerów`}
                  {files.length === 0 && selectedPartners.size > 0 && `${selectedPartners.size} partner(ów) wybranych — dodaj pliki`}
                  {files.length > 0 && selectedPartners.size > 0 &&
                    `${files.length} plik(i) → ${selectedPartners.size} partner(ów) (${selectedPartners.size} osobnych wysyłek)`}
                </p>
              </div>
              <Button
                onClick={handleSend}
                disabled={sending || files.length === 0 || selectedPartners.size === 0}
                className="gap-2 min-w-32"
              >
                {sending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Wysyłanie...</>
                ) : (
                  <><Send className="h-4 w-4" /> Wyślij pliki</>
                )}
              </Button>
            </div>

            {/* Sent status */}
            {sentPartners.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Ostatnio wysłano do:</p>
                <div className="flex flex-wrap gap-1">
                  {sentPartners.map((name) => (
                    <Badge key={name} variant="secondary" className="text-xs gap-1 text-success">
                      <CheckCircle2 className="h-3 w-3" />
                      {name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
