// Edge Function: list-submissions
// Liste publique (mode QR / non authentifié) des productions d'une classe ou
// de tout un enseignant. N'expose JAMAIS transcription, feedback complet ou
// error : seuls les champs nécessaires à la vitrine sont renvoyés, et seules
// les submissions avec status='done' sont visibles.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LOG_PREFIX = "[list-submissions]";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SubmissionRow = {
  id: string;
  student_name: string;
  avatar_url: string | null;
  status: "pending" | "processing" | "done" | "error";
  feedback: { score_global?: number } | null;
  created_at: string;
  classes: {
    nom: string;
    matiere: string | null;
    teacher_id: string;
  } | null;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error(LOG_PREFIX, "Missing server configuration");
      return json({ error: "Missing server configuration" }, 500);
    }

    let payload: { teacherId?: unknown; classId?: unknown };
    try {
      payload = await req.json();
    } catch {
      return json({ error: "Body JSON invalide" }, 400);
    }

    const teacherId = payload?.teacherId;
    const classId = payload?.classId;

    if (typeof teacherId !== "string" || !UUID_RE.test(teacherId)) {
      return json({ error: "teacherId requis (UUID)" }, 400);
    }

    let classIdValidated: string | null = null;
    if (classId !== undefined && classId !== null && classId !== "") {
      if (typeof classId !== "string" || !UUID_RE.test(classId)) {
        return json({ error: "classId invalide (UUID attendu)" }, 400);
      }
      classIdValidated = classId;
    }

    console.log(LOG_PREFIX, "fetch", { teacherId, classId: classIdValidated });

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    let query = supabase
      .from("submissions")
      .select(
        "id, student_name, avatar_url, status, feedback, created_at, classes!inner(nom, matiere, teacher_id)",
      )
      .eq("classes.teacher_id", teacherId)
      .eq("status", "done")
      .order("created_at", { ascending: false });

    if (classIdValidated) {
      query = query.eq("class_id", classIdValidated);
    }

    const { data, error } = await query;

    if (error) {
      console.error(LOG_PREFIX, "query error:", error);
      return json({ error: error.message }, 500);
    }

    const rows = (data || []) as SubmissionRow[];

    const submissions = rows.map((r) => {
      const score = r.feedback && typeof r.feedback.score_global === "number"
        ? r.feedback.score_global
        : null;
      return {
        id: r.id,
        student_name: r.student_name,
        avatar_url: r.avatar_url,
        score_global: score,
        status: r.status,
        created_at: r.created_at,
        classe: r.classes
          ? { nom: r.classes.nom, matiere: r.classes.matiere }
          : null,
      };
    });

    console.log(LOG_PREFIX, "ok", submissions.length, "submissions");

    return json({ submissions });
  } catch (e) {
    const err = e as Error;
    console.error(LOG_PREFIX, "ERREUR:", err?.message, err?.stack);
    return json({ error: err?.message || "Erreur inattendue" }, 500);
  }
});
