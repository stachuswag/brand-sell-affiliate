import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Read body once
    const body = await req.json();
    const { action, partner_id, partner_name, email, password, user_id } = body;

    if (action === "create") {
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: partner_name },
      });

      if (authError) throw authError;

      const userId = authData.user.id;

      // Insert or update user_roles as agent linked to partner
      // First delete any existing role for this user, then insert fresh
      await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: userId, role: "agent", partner_id });

      if (roleError) throw roleError;

      // Link partner to this user
      const { error: partnerError } = await supabaseAdmin
        .from("partners")
        .update({ agent_user_id: userId })
        .eq("id", partner_id);

      if (partnerError) throw partnerError;

      return new Response(
        JSON.stringify({ success: true, user_id: userId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "reset_password") {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(
        user_id ?? "",
        { password }
      );
      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "delete") {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(user_id ?? "");
      if (error) throw error;

      // Unlink partner
      await supabaseAdmin
        .from("partners")
        .update({ agent_user_id: null })
        .eq("agent_user_id", user_id);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "object" && err !== null && "message" in err
        ? String((err as { message: unknown }).message)
        : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
