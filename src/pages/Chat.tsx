import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Hash, MessageSquare, Plus, Users, Send, Paperclip, X,
  Download, FileText, Image as ImageIcon, ChevronRight, Search, UserPlus, Loader2, EyeOff
} from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import { pl } from "date-fns/locale";

// ---- Types ----
interface Channel {
  id: string;
  name: string | null;
  type: "general" | "direct" | "group";
  created_by: string | null;
  updated_at: string;
  other_user_name?: string;
  unread?: number;
  // membership info
  closed_at?: string | null;
  membership_id?: string;
}

interface Message {
  id: string;
  channel_id: string;
  sender_id: string;
  content: string | null;
  file_url: string | null;
  file_name: string | null;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
  sender_name?: string;
}

interface UserProfile {
  user_id: string;
  full_name: string | null;
  email: string | null;
}

// ---- Helpers ----
function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return `Dzisiaj ${format(d, "HH:mm")}`;
  if (isYesterday(d)) return `Wczoraj ${format(d, "HH:mm")}`;
  return format(d, "d MMM HH:mm", { locale: pl });
}

function formatBytes(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(type: string | null) {
  return type?.startsWith("image/");
}

// ---- Main Component ----
export default function Chat() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [channelMembers, setChannelMembers] = useState<UserProfile[]>([]);

  // New DM dialog
  const [dmOpen, setDmOpen] = useState(false);
  const [dmSearch, setDmSearch] = useState("");

  // New Group dialog
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupSelected, setGroupSelected] = useState<string[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---- Load all users (only those with active roles) ----
  const loadAllUsers = useCallback(async () => {
    if (!user) return;
    const [{ data: profiles }, { data: partnerAgents }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name, email"),
      supabase.from("partners").select("agent_user_id, name").eq("is_active", true).not("agent_user_id", "is", null),
      supabase.from("user_roles").select("user_id, role"),
    ]);

    // Only keep users that have an active role entry
    // For agents, also check that their partner is active
    const agentUserIds = new Set(
      (partnerAgents ?? []).filter((p) => p.agent_user_id).map((p) => p.agent_user_id)
    );
    const activeUserIds = new Set(
      (roles ?? [])
        .filter((r) => {
          // If user is an agent, only include if they're linked to an active partner
          if (r.role === 'agent') return agentUserIds.has(r.user_id);
          return true;
        })
        .map((r) => r.user_id)
    );

    const agentNameMap = new Map(
      (partnerAgents ?? []).map((p) => [p.agent_user_id, p.name])
    );
    const enriched = (profiles ?? [])
      .filter((p) => activeUserIds.has(p.user_id)) // filter out orphaned profiles
      .map((p) => ({
        ...p,
        full_name: agentNameMap.get(p.user_id) ?? p.full_name,
      }));
    setAllUsers(enriched.filter((p) => p.user_id !== user.id) as UserProfile[]);
    return enriched;
  }, [user]);

  // ---- Load channels ----
  const loadChannels = useCallback(async () => {
    if (!user) return;

    // Ensure "Ogólny" general channel exists
    const { data: existing } = await supabase
      .from("chat_channels")
      .select("id")
      .eq("type", "general")
      .limit(1);

    if (!existing || existing.length === 0) {
      await supabase.from("chat_channels").insert({
        type: "general",
        name: "Ogólny",
        created_by: user.id,
      });
    }

    const { data: chans } = await supabase
      .from("chat_channels")
      .select("*")
      .order("updated_at", { ascending: false });

    if (!chans) return;

    const enrichedProfiles = await loadAllUsers() ?? [];
    const profileMap = new Map(enrichedProfiles.map((p) => [p.user_id, p]));

    // Get user's memberships with closed_at info
    const { data: memberships } = await supabase
      .from("chat_channel_members")
      .select("channel_id, closed_at, id")
      .eq("user_id", user.id);

    const membershipMap = new Map(
      (memberships ?? []).map((m) => [m.channel_id, { closed_at: m.closed_at, id: m.id }])
    );

    const enrichedResults = await Promise.all(
      chans.map(async (c): Promise<Channel | null> => {
        const membership = membershipMap.get(c.id);
        const base = {
          ...c,
          type: c.type as "general" | "direct" | "group",
          closed_at: membership?.closed_at ?? null,
          membership_id: membership?.id,
        };

        if (c.type === "direct") {
          const { data: members } = await supabase
            .from("chat_channel_members")
            .select("user_id")
            .eq("channel_id", c.id);
          const otherId = members?.find((m) => m.user_id !== user.id)?.user_id;
          const profile = otherId ? profileMap.get(otherId) : null;

          if (!otherId || !profile) {
            return null;
          }

          return {
            ...base,
            other_user_name: profile.full_name ?? profile.email ?? "Nieznany",
          };
        }
        return base;
      })
    );

    const enriched = enrichedResults.filter((channel): channel is Channel => channel !== null);

    // Filter: show channel if:
    // - general (always show)
    // - not closed (closed_at is null) 
    // - closed but updated_at > closed_at (new message came in after closing)
    const visible = enriched.filter((ch) => {
      if (ch.type === "general") return true;
      if (!ch.closed_at) return true; // not closed
      // reopen if channel has new activity after closing
      return new Date(ch.updated_at) > new Date(ch.closed_at);
    });

    setChannels(visible);
    return visible;
  }, [user, loadAllUsers]);

  useEffect(() => {
    loadAllUsers();
    loadChannels();
  }, [loadAllUsers, loadChannels]);

  // ---- Realtime: watch for new messages to reopen closed channels ----
  useEffect(() => {
    if (!user) return;
    const sub = supabase
      .channel("global-messages-watch")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        () => {
          // Reload channels so closed ones reappear when new msg arrives
          loadChannels();
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [user, loadChannels]);

  // ---- Load messages for active channel ----
  const loadMessages = useCallback(async (channelId: string) => {
    const { data } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("channel_id", channelId)
      .order("created_at", { ascending: true });

    if (!data) return;

    const senderIds = [...new Set(data.map((m) => m.sender_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, email")
      .in("user_id", senderIds);
    const profileMap = new Map((profiles ?? []).map((p) => [p.user_id, p]));

    setMessages(
      data.map((m) => ({
        ...m,
        sender_name:
          profileMap.get(m.sender_id)?.full_name ??
          profileMap.get(m.sender_id)?.email ??
          "Nieznany",
      }))
    );
  }, []);

  // ---- Load channel members ----
  const loadChannelMembers = useCallback(async (channelId: string) => {
    const { data: members } = await supabase
      .from("chat_channel_members")
      .select("user_id")
      .eq("channel_id", channelId);
    if (!members) return;
    const ids = members.map((m) => m.user_id);
    if (ids.length === 0) return;
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, email")
      .in("user_id", ids);
    setChannelMembers((profiles ?? []) as UserProfile[]);
  }, []);

  useEffect(() => {
    if (!activeChannel) return;
    loadMessages(activeChannel.id);
    loadChannelMembers(activeChannel.id);
  }, [activeChannel, loadMessages, loadChannelMembers]);

  // ---- Realtime subscription for active channel ----
  useEffect(() => {
    if (!activeChannel) return;

    const channel = supabase
      .channel(`chat-${activeChannel.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `channel_id=eq.${activeChannel.id}` },
        async (payload) => {
          const msg = payload.new as Message;
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, email")
            .eq("user_id", msg.sender_id)
            .maybeSingle();
          setMessages((prev) => [
            ...prev,
            { ...msg, sender_name: profile?.full_name ?? profile?.email ?? "Nieznany" },
          ]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeChannel?.id]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ---- Select channel (auto-join general) ----
  const selectChannel = async (ch: Channel) => {
    setActiveChannel(ch);
    if (ch.type === "general") {
      await supabase
        .from("chat_channel_members")
        .upsert({ channel_id: ch.id, user_id: user!.id }, { onConflict: "channel_id,user_id" });
    }
  };

  // ---- Close / archive a conversation ----
  const closeConversation = async (ch: Channel, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;

    await supabase
      .from("chat_channel_members")
      .update({ closed_at: new Date().toISOString() })
      .eq("channel_id", ch.id)
      .eq("user_id", user.id);

    // If this was the active channel, deselect it
    if (activeChannel?.id === ch.id) {
      setActiveChannel(null);
      setMessages([]);
    }

    toast({ title: "Rozmowa ukryta", description: "Pojawi się ponownie gdy przyjdzie nowa wiadomość." });
    loadChannels();
  };

  // ---- Send message ----
  const sendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!activeChannel || (!input.trim() && !pendingFile)) return;

    setSending(true);
    let fileUrl = null, fileName = null, fileType = null, fileSize = null;

    if (pendingFile) {
      setUploading(true);
      const path = `${user!.id}/${Date.now()}_${pendingFile.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("chat-files")
        .upload(path, pendingFile);
      setUploading(false);

      if (uploadError) {
        toast({ title: "Błąd uploadu", description: uploadError.message, variant: "destructive" });
        setSending(false);
        return;
      }

      const { data: { publicUrl } } = supabase.storage.from("chat-files").getPublicUrl(uploadData.path);
      fileUrl = publicUrl;
      fileName = pendingFile.name;
      fileType = pendingFile.type;
      fileSize = pendingFile.size;
      setPendingFile(null);
    }

    const { error } = await supabase.from("chat_messages").insert({
      channel_id: activeChannel.id,
      sender_id: user!.id,
      content: input.trim() || null,
      file_url: fileUrl,
      file_name: fileName,
      file_type: fileType,
      file_size: fileSize,
    });

    if (error) {
      toast({ title: "Błąd", description: error.message, variant: "destructive" });
    } else {
      setInput("");
      await supabase.from("chat_channels").update({ updated_at: new Date().toISOString() }).eq("id", activeChannel.id);
      loadChannels();
    }
    setSending(false);
  };

  // ---- File handling ----
  const handleFile = (file: File) => {
    if (file.size > 20 * 1024 * 1024) {
      toast({ title: "Plik za duży", description: "Maksymalny rozmiar to 20MB", variant: "destructive" });
      return;
    }
    setPendingFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  // ---- Create DM ----
  const createDM = async (targetUserId: string) => {
    // Find existing direct channel between these two users
    const { data: myMemberships } = await supabase
      .from("chat_channel_members")
      .select("channel_id")
      .eq("user_id", user!.id);
    const myIds = (myMemberships ?? []).map((m) => m.channel_id);

    if (myIds.length > 0) {
      const { data: shared } = await supabase
        .from("chat_channel_members")
        .select("channel_id")
        .eq("user_id", targetUserId)
        .in("channel_id", myIds);

      for (const { channel_id } of shared ?? []) {
        const { data: chanData } = await supabase
          .from("chat_channels")
          .select("*")
          .eq("id", channel_id)
          .eq("type", "direct")
          .maybeSingle();
        if (!chanData) continue;

        // Verify it's truly a 1:1 DM (exactly 2 members)
        const { count } = await supabase
          .from("chat_channel_members")
          .select("id", { count: "exact", head: true })
          .eq("channel_id", channel_id);
        if (count !== 2) continue;

        // Found existing DM — reopen if closed and navigate to it
        await supabase
          .from("chat_channel_members")
          .update({ closed_at: null })
          .eq("channel_id", channel_id)
          .eq("user_id", user!.id);
        setDmOpen(false);
        await loadChannels();
        const profile = allUsers.find((u) => u.user_id === targetUserId);
        selectChannel({
          ...chanData,
          type: "direct",
          other_user_name: profile?.full_name ?? profile?.email ?? "Nieznany",
          closed_at: null,
        });
        return;
      }
    }

    // No existing DM found — create new one
    const { data: newChan, error } = await supabase
      .from("chat_channels")
      .insert({ type: "direct", created_by: user!.id })
      .select()
      .single();
    if (error || !newChan) return;

    await supabase.from("chat_channel_members").insert([
      { channel_id: newChan.id, user_id: user!.id },
      { channel_id: newChan.id, user_id: targetUserId },
    ]);

    setDmOpen(false);
    await loadChannels();
    const profile = allUsers.find((u) => u.user_id === targetUserId);
    selectChannel({
      ...newChan,
      type: "direct",
      other_user_name: profile?.full_name ?? profile?.email ?? "Nieznany",
      closed_at: null,
    });
  };

  // ---- Create Group ----
  const createGroup = async () => {
    if (!groupName.trim()) return;
    const { data: newChan, error } = await supabase
      .from("chat_channels")
      .insert({ type: "group", name: groupName.trim(), created_by: user!.id })
      .select()
      .single();
    if (error || !newChan) return;

    const membersToAdd = [user!.id, ...groupSelected].map((uid) => ({
      channel_id: newChan.id,
      user_id: uid,
    }));
    await supabase.from("chat_channel_members").insert(membersToAdd);

    setGroupOpen(false);
    setGroupName("");
    setGroupSelected([]);
    await loadChannels();
    selectChannel({ ...newChan, type: "group", closed_at: null });
  };

  const channelDisplayName = (ch: Channel) => {
    if (ch.type === "direct") return ch.other_user_name ?? "Wiadomość prywatna";
    return ch.name ?? "Kanał";
  };

  const filteredDMUsers = allUsers.filter((u) =>
    (u.full_name ?? u.email ?? "").toLowerCase().includes(dmSearch.toLowerCase())
  );

  // Sidebar channel button with close button
  const ChannelButton = ({ ch }: { ch: Channel }) => (
    <div className="group/item relative">
      <button
        onClick={() => selectChannel(ch)}
        className={cn(
          "w-full flex items-center gap-2 rounded-lg px-2 py-2 pr-8 text-sm text-left transition-colors",
          activeChannel?.id === ch.id
            ? "bg-primary/10 text-primary font-medium"
            : "text-foreground hover:bg-muted"
        )}
      >
        {ch.type === "general" && <Hash className="h-4 w-4 flex-shrink-0" />}
        {ch.type === "group" && <Users className="h-4 w-4 flex-shrink-0" />}
        {ch.type === "direct" && (
          <div className="h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">
            {(ch.other_user_name ?? "?").charAt(0).toUpperCase()}
          </div>
        )}
        <span className="truncate">{channelDisplayName(ch)}</span>
      </button>
      {ch.type !== "general" && (
        <button
          onClick={(e) => closeConversation(ch, e)}
          title="Ukryj rozmowę"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover/item:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground"
        >
          <EyeOff className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );

  return (
    <AppShell>
      <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden bg-background">
        {/* ---- Sidebar ---- */}
        <aside className="w-72 flex-shrink-0 bg-card border-r border-border flex flex-col">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <MessageSquare className="h-4.5 w-4.5 text-primary" />
              Wiadomości
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto py-3">
            {/* Channels */}
            <div className="px-3 mb-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 mb-2">Kanały</p>
              <div className="space-y-0.5">
                {channels.filter((c) => c.type === "general" || c.type === "group").map((ch) => (
                  <ChannelButton key={ch.id} ch={ch} />
                ))}
              </div>
              <button
                onClick={() => setGroupOpen(true)}
                className="w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors mt-1"
              >
                <Plus className="h-3.5 w-3.5" /> Utwórz grupę
              </button>
            </div>

            {/* Direct messages */}
            <div className="px-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 mb-2">Wiadomości prywatne</p>
              <div className="space-y-0.5">
                {channels.filter((c) => c.type === "direct").map((ch) => (
                  <ChannelButton key={ch.id} ch={ch} />
                ))}
              </div>
              <button
                onClick={() => setDmOpen(true)}
                className="w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors mt-1"
              >
                <UserPlus className="h-3.5 w-3.5" /> Nowa wiadomość
              </button>
            </div>
          </div>
        </aside>

        {/* ---- Main chat area ---- */}
        {activeChannel ? (
          <div
            className="flex flex-1 flex-col overflow-hidden"
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            {/* Channel header */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-card shrink-0">
              {activeChannel.type === "general" && <Hash className="h-4 w-4 text-muted-foreground" />}
              {activeChannel.type === "group" && <Users className="h-4 w-4 text-muted-foreground" />}
              {activeChannel.type === "direct" && (
                <div className="h-7 w-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                  {(activeChannel.other_user_name ?? "?").charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <p className="font-semibold text-sm text-foreground">{channelDisplayName(activeChannel)}</p>
                {activeChannel.type !== "direct" && (
                  <p className="text-xs text-muted-foreground">
                    {channelMembers.length} {channelMembers.length === 1 ? "uczestnik" : "uczestników"}
                  </p>
                )}
              </div>
              <div className="ml-auto flex items-center gap-2">
                {activeChannel.type !== "direct" && (
                  <div className="flex -space-x-1">
                    {channelMembers.slice(0, 4).map((m) => (
                      <div
                        key={m.user_id}
                        title={m.full_name ?? m.email ?? "Nieznany"}
                        className="h-6 w-6 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center border-2 border-card"
                      >
                        {(m.full_name ?? m.email ?? "?").charAt(0).toUpperCase()}
                      </div>
                    ))}
                    {channelMembers.length > 4 && (
                      <div className="h-6 w-6 rounded-full bg-muted text-muted-foreground text-[10px] font-bold flex items-center justify-center border-2 border-card">
                        +{channelMembers.length - 4}
                      </div>
                    )}
                  </div>
                )}
                {activeChannel.type !== "general" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground gap-1.5 text-xs h-8"
                    onClick={(e) => closeConversation(activeChannel, e)}
                  >
                    <EyeOff className="h-3.5 w-3.5" />
                    Ukryj
                  </Button>
                )}
              </div>
            </div>

            {/* Drag overlay */}
            {dragOver && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-primary/10 border-4 border-dashed border-primary rounded-none pointer-events-none">
                <p className="text-lg font-semibold text-primary">Upuść plik tutaj</p>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                  <MessageSquare className="h-12 w-12 text-muted-foreground/40" />
                  <p className="text-sm font-medium text-muted-foreground">Brak wiadomości</p>
                  <p className="text-xs text-muted-foreground">Napisz pierwszą wiadomość!</p>
                </div>
              )}
              {messages.map((msg, idx) => {
                const isOwn = msg.sender_id === user?.id;
                const showName = !isOwn && (idx === 0 || messages[idx - 1]?.sender_id !== msg.sender_id);
                return (
                  <div key={msg.id} className={cn("flex gap-2 group", isOwn && "flex-row-reverse")}>
                    {!isOwn && (
                      <div className={cn("h-7 w-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-1", !showName && "opacity-0")}>
                        {(msg.sender_name ?? "?").charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className={cn("max-w-[65%] space-y-0.5", isOwn && "items-end flex flex-col")}>
                      {showName && !isOwn && (
                        <p className="text-xs font-semibold text-foreground px-1">{msg.sender_name}</p>
                      )}
                      {msg.content && (
                        <div className={cn(
                          "rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                          isOwn
                            ? "bg-primary text-primary-foreground rounded-tr-sm"
                            : "bg-muted text-foreground rounded-tl-sm"
                        )}>
                          {msg.content}
                        </div>
                      )}
                      {msg.file_url && (
                        <div className={cn(
                          "rounded-xl overflow-hidden border",
                          isOwn ? "border-primary/20" : "border-border"
                        )}>
                          {isImage(msg.file_type) ? (
                            <a href={msg.file_url} target="_blank" rel="noopener noreferrer">
                              <img src={msg.file_url} alt={msg.file_name ?? "obraz"} className="max-w-xs max-h-64 object-cover" />
                            </a>
                          ) : (
                            <a
                              href={msg.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={cn(
                                "flex items-center gap-3 px-3.5 py-2.5 text-sm",
                                isOwn ? "bg-primary/10 text-primary" : "bg-muted text-foreground"
                              )}
                            >
                              <FileText className="h-5 w-5 flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="truncate font-medium">{msg.file_name}</p>
                                <p className="text-xs opacity-60">{formatBytes(msg.file_size)}</p>
                              </div>
                              <Download className="h-4 w-4 flex-shrink-0 ml-1 opacity-60" />
                            </a>
                          )}
                        </div>
                      )}
                      <p className={cn("text-[10px] text-muted-foreground px-1", isOwn && "text-right")}>
                        {formatDate(msg.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Pending file preview */}
            {pendingFile && (
              <div className="px-4 pb-0 pt-2">
                <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2 text-sm">
                  {pendingFile.type.startsWith("image/")
                    ? <ImageIcon className="h-4 w-4 text-primary" />
                    : <FileText className="h-4 w-4 text-primary" />
                  }
                  <span className="truncate flex-1">{pendingFile.name}</span>
                  <span className="text-xs text-muted-foreground">{formatBytes(pendingFile.size)}</span>
                  <button onClick={() => setPendingFile(null)} className="ml-1 text-muted-foreground hover:text-destructive">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Input */}
            <form onSubmit={sendMessage} className="flex items-end gap-2 p-4 border-t border-border bg-card shrink-0">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="flex-shrink-0 h-9 w-9"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder={`Napisz do ${channelDisplayName(activeChannel)}... (Enter = wyślij, Shift+Enter = nowa linia)`}
                rows={1}
                className="flex-1 resize-none min-h-[36px] max-h-32 py-2"
              />
              <Button
                type="submit"
                size="icon"
                className="flex-shrink-0 h-9 w-9"
                disabled={sending || uploading || (!input.trim() && !pendingFile)}
              >
                {sending || uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center flex-col gap-3 text-center p-8">
            <div className="h-20 w-20 rounded-2xl bg-primary/5 flex items-center justify-center mb-2">
              <MessageSquare className="h-10 w-10 text-primary/40" />
            </div>
            <p className="text-lg font-semibold text-foreground">Wybierz rozmowę</p>
            <p className="text-sm text-muted-foreground max-w-xs">Kliknij na kanał lub osobę po lewej, aby rozpocząć konwersację</p>
          </div>
        )}
      </div>

      {/* New DM Dialog */}
      <Dialog open={dmOpen} onOpenChange={setDmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nowa wiadomość prywatna</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Szukaj użytkownika..."
                value={dmSearch}
                onChange={(e) => setDmSearch(e.target.value)}
              />
            </div>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {filteredDMUsers.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Brak użytkowników</p>
              )}
              {filteredDMUsers.map((u) => (
                <button
                  key={u.user_id}
                  onClick={() => createDM(u.user_id)}
                  className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted transition-colors text-left"
                >
                  <div className="h-8 w-8 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center flex-shrink-0">
                    {(u.full_name ?? u.email ?? "?").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{u.full_name ?? u.email}</p>
                    {u.full_name && <p className="text-xs text-muted-foreground">{u.email}</p>}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Group Dialog */}
      <Dialog open={groupOpen} onOpenChange={setGroupOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Utwórz grupę</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nazwa grupy</label>
              <Input
                placeholder="np. Zespół sprzedaży..."
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Dodaj uczestników</label>
              <div className="space-y-1 max-h-52 overflow-y-auto border rounded-lg p-1">
                {allUsers.map((u) => (
                  <button
                    key={u.user_id}
                    onClick={() => setGroupSelected((prev) =>
                      prev.includes(u.user_id)
                        ? prev.filter((id) => id !== u.user_id)
                        : [...prev, u.user_id]
                    )}
                    className={cn(
                      "w-full flex items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors",
                      groupSelected.includes(u.user_id)
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-muted text-foreground"
                    )}
                  >
                    <div className={cn(
                      "h-4 w-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors",
                      groupSelected.includes(u.user_id)
                        ? "bg-primary border-primary"
                        : "border-border"
                    )}>
                      {groupSelected.includes(u.user_id) && (
                        <svg className="h-3 w-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{u.full_name ?? u.email}</p>
                      {u.full_name && <p className="text-xs text-muted-foreground">{u.email}</p>}
                    </div>
                  </button>
                ))}
              </div>
              {groupSelected.length > 0 && (
                <p className="text-xs text-muted-foreground">Wybrano: {groupSelected.length} uczestników</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGroupOpen(false)}>Anuluj</Button>
            <Button onClick={createGroup} disabled={!groupName.trim()}>
              Utwórz grupę
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
