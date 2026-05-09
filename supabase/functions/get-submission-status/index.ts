// Edge Function: get-submission-status
// Lecture publique (anonyme) du statut + résultat d'une submission par id.
// Utilisée par /processing (polling) et /result (rendu final).
//
// L'élève n'est pas authentifié et la RLS de submissions n'autorise SELECT
// qu'à l'enseignant·e propriétaire ou à l'admin. Cette fonction utilise
// service_role pour permettre à un porteur d'UUID de submission de lire
// son propre résultat (modèle "secret partagé via UUID", comme une signed URL).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LOG_PREFIX = "[get-submission-status]";

const UUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Méthode non autorisée" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceKey) {
    console.error(LOG_PREFIX, "Secrets manquants");
    return jsonResponse({ error: "Configuration serveur incomplète" }, 500);
  }

  let payload: { id?: unknown };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Body JSON invalide" }, 400);
  }

  const id = payload?.id;
  if (typeof id !== "string" || !UUID_REGEX.test(id)) {
    return jsonResponse({ error: "id UUID invalide" }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase
    .from("submissions")
    .select("status, error, class_id, student_name, transcription, feedback, avatar_url")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error(LOG_PREFIX, "SELECT error:", error);
    return jsonResponse({ error: "Échec lecture submission" }, 500);
  }

  if (!data) {
    return jsonResponse({ error: "Submission introuvable" }, 404);
  }

  return jsonResponse(data);
});
