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

    const { action, partner_id, partner_name, email, password } = await req.json();

    if (action === "create") {
      // Create auth user
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: partner_name },
      });

      if (authError) throw authError;

      const userId = authData.user.id;

      // Upsert user_roles as agent linked to partner
      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: userId, role: "agent", partner_id }, { onConflict: "user_id" });

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
      const { user_id } = await req.json().catch(() => ({ user_id: null }));
      // reset_password uses email + password from body
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
      const { user_id } = await req.json().catch(() => ({ user_id: null }));
      const { error } = await supabaseAdmin.auth.admin.deleteUser(user_id ?? "");
      if (error) throw error;
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
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
