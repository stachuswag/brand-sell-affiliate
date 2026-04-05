import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

type SupabaseAdminClient = ReturnType<typeof createClient>;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

function isMissingUserError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes("user not found") || message.includes("not found") || message.includes("does not exist");
}

async function ensureSuccess(operation: Promise<{ error: unknown | null }>) {
  const { error } = await operation;
  if (error) throw error;
}

async function cleanupPartnerData(supabaseAdmin: SupabaseAdminClient, partnerId: string) {
  const { data: links, error: linksError } = await supabaseAdmin
    .from("affiliate_links")
    .select("id")
    .eq("partner_id", partnerId);

  if (linksError) throw linksError;

  const linkIds = links?.map((link) => link.id) ?? [];
  let contactIds: string[] = [];

  if (linkIds.length > 0) {
    const { data: contacts, error: contactsError } = await supabaseAdmin
      .from("contacts")
      .select("id")
      .in("affiliate_link_id", linkIds);

    if (contactsError) throw contactsError;
    contactIds = contacts?.map((contact) => contact.id) ?? [];
  }

  if (contactIds.length > 0) {
    await ensureSuccess(supabaseAdmin.from("notifications").delete().in("contact_id", contactIds));
    await ensureSuccess(supabaseAdmin.from("transactions").delete().in("contact_id", contactIds));
  }

  if (linkIds.length > 0) {
    await ensureSuccess(supabaseAdmin.from("link_clicks").delete().in("affiliate_link_id", linkIds));
    await ensureSuccess(supabaseAdmin.from("notifications").delete().in("affiliate_link_id", linkIds));
    await ensureSuccess(supabaseAdmin.from("transactions").delete().in("affiliate_link_id", linkIds));
    await ensureSuccess(supabaseAdmin.from("contacts").delete().in("affiliate_link_id", linkIds));
  }

  await ensureSuccess(supabaseAdmin.from("transactions").delete().eq("partner_id", partnerId));
  await ensureSuccess(supabaseAdmin.from("partner_offers").delete().eq("partner_id", partnerId));
  await ensureSuccess(supabaseAdmin.from("affiliate_links").delete().eq("partner_id", partnerId));
  await ensureSuccess(supabaseAdmin.from("user_roles").delete().eq("partner_id", partnerId));
  await ensureSuccess(supabaseAdmin.from("partners").delete().eq("id", partnerId));
}

async function cleanupUserData(supabaseAdmin: SupabaseAdminClient, userId: string) {
  const { data: memberships, error: membershipsError } = await supabaseAdmin
    .from("chat_channel_members")
    .select("channel_id")
    .eq("user_id", userId);

  if (membershipsError) throw membershipsError;

  const channelIds = memberships?.map((membership) => membership.channel_id) ?? [];
  let directChannelIds: string[] = [];

  if (channelIds.length > 0) {
    const { data: directChannels, error: directChannelsError } = await supabaseAdmin
      .from("chat_channels")
      .select("id")
      .eq("type", "direct")
      .in("id", channelIds);

    if (directChannelsError) throw directChannelsError;
    directChannelIds = directChannels?.map((channel) => channel.id) ?? [];
  }

  if (directChannelIds.length > 0) {
    await ensureSuccess(supabaseAdmin.from("chat_messages").delete().in("channel_id", directChannelIds));
    await ensureSuccess(supabaseAdmin.from("chat_channel_members").delete().in("channel_id", directChannelIds));
    await ensureSuccess(supabaseAdmin.from("chat_channels").delete().in("id", directChannelIds));
  }

  await ensureSuccess(supabaseAdmin.from("chat_messages").delete().eq("sender_id", userId));
  await ensureSuccess(supabaseAdmin.from("chat_channel_members").delete().eq("user_id", userId));
  await ensureSuccess(supabaseAdmin.from("notifications").delete().eq("user_id", userId));
  await ensureSuccess(supabaseAdmin.from("user_roles").delete().eq("user_id", userId));
  await ensureSuccess(supabaseAdmin.from("profiles").delete().eq("user_id", userId));
  await ensureSuccess(supabaseAdmin.from("partners").update({ agent_user_id: null }).eq("agent_user_id", userId));

  const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (authDeleteError && !isMissingUserError(authDeleteError)) {
    throw authDeleteError;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Brak autoryzacji." }, 401);
    }

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user: requestingUser },
      error: authError,
    } = await supabaseUser.auth.getUser();

    if (authError || !requestingUser) {
      return jsonResponse({ error: "Brak autoryzacji." }, 401);
    }

    const { data: requesterRole, error: requesterRoleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", requestingUser.id)
      .maybeSingle();

    if (requesterRoleError) throw requesterRoleError;

    if (requesterRole?.role !== "admin") {
      return jsonResponse({ error: "Brak uprawnień administratora." }, 403);
    }

    const body = await req.json();
    const { action, partner_id, partner_name, email, password, user_id } = body;

    if (action === "create") {
      if (!email || !password || !partner_id || !partner_name) {
        return jsonResponse({ error: "Brakuje danych do utworzenia konta." }, 400);
      }

      const normalizedEmail = String(email).trim().toLowerCase();

      const { data: partnerData, error: partnerLookupError } = await supabaseAdmin
        .from("partners")
        .select("id, name, agent_user_id")
        .eq("id", partner_id)
        .maybeSingle();

      if (partnerLookupError) throw partnerLookupError;
      if (!partnerData) {
        return jsonResponse({ error: "Nie znaleziono partnera." }, 404);
      }

      if (partnerData.agent_user_id) {
        return jsonResponse({ success: true, user_id: partnerData.agent_user_id, already_exists: true });
      }

      const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      if (listError) throw listError;

      const existing = listData.users.find((existingUser) => existingUser.email?.toLowerCase() === normalizedEmail);
      let userId: string;

      if (existing) {
        const { data: linkedPartner, error: linkedPartnerError } = await supabaseAdmin
          .from("partners")
          .select("id, name")
          .eq("agent_user_id", existing.id)
          .maybeSingle();

        if (linkedPartnerError) throw linkedPartnerError;

        const { data: existingRoles, error: existingRolesError } = await supabaseAdmin
          .from("user_roles")
          .select("role, partner_id")
          .eq("user_id", existing.id);

        if (existingRolesError) throw existingRolesError;

        const linkedToOtherPartner = Boolean(linkedPartner && linkedPartner.id !== partner_id);
        const roleAssignedToOtherPartner = (existingRoles ?? []).some(
          (roleRow) => roleRow.role === "agent" && roleRow.partner_id && roleRow.partner_id !== partner_id,
        );
        const isAdmin = (existingRoles ?? []).some((roleRow) => roleRow.role === "admin");

        if (linkedToOtherPartner || roleAssignedToOtherPartner) {
          return jsonResponse(
            {
              error: linkedPartner
                ? `Ten login jest już przypisany do partnera ${linkedPartner.name}. Każdy partner musi mieć osobny email logowania.`
                : "Ten login jest już używany jako agent innego partnera.",
            },
            409,
          );
        }

        if (isAdmin) {
          return jsonResponse({ error: "Ten email należy do konta administratora — nie można go użyć jako loginu agenta." }, 409);
        }

        userId = existing.id;
        const { error: updateUserError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          password,
          user_metadata: { full_name: partner_name },
        });

        if (updateUserError) throw updateUserError;
      } else {
        const { data: authData, error: authErrorCreate } = await supabaseAdmin.auth.admin.createUser({
          email: normalizedEmail,
          password,
          email_confirm: true,
          user_metadata: { full_name: partner_name },
        });

        if (authErrorCreate) throw authErrorCreate;
        userId = authData.user.id;
      }

      // Remove any existing employee role and set agent role
      await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: userId, role: "agent", partner_id });

      if (roleError) throw roleError;

      const { error: partnerError } = await supabaseAdmin
        .from("partners")
        .update({ agent_user_id: userId, login_email: normalizedEmail })
        .eq("id", partner_id);

      if (partnerError) throw partnerError;

      return jsonResponse({ success: true, user_id: userId });
    }

    if (action === "reset_password") {
      if (!user_id || !password) {
        return jsonResponse({ error: "Brakuje danych do zmiany hasła." }, 400);
      }

      const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, { password });
      if (error) throw error;
      return jsonResponse({ success: true });
    }

    if (action === "delete") {
      if (!user_id && !partner_id) {
        return jsonResponse({ error: "Brak identyfikatora partnera lub użytkownika." }, 400);
      }

      if (partner_id) {
        await cleanupPartnerData(supabaseAdmin, partner_id);
      }

      if (user_id) {
        await cleanupUserData(supabaseAdmin, user_id);
      }

      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (err: unknown) {
    return jsonResponse({ error: getErrorMessage(err) }, 500);
  }
});