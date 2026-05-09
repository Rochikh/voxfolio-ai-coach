// Edge Function: process-submission
// Orchestre le pipeline IA Voxfolio : Groq Whisper → OpenRouter (feedback adapté
// à la matière / consignes de la classe) → fal.ai (image), puis met à jour la
// ligne `submissions` correspondante.
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LOG_PREFIX = "[process-submission]";

const SYSTEM_PROMPT_TEMPLATE = `Tu es Voxfolio, un coach bienveillant et exigeant en expression orale, qui aide des apprenants à progresser sur leurs présentations.

CONTEXTE DE LA CLASSE :
- Matière : {{matiere}}
- Consignes spécifiques de l'enseignant·e : {{consignes_evaluation}}

(Si matiere est null/absent, remplace par "non précisée". Si consignes_evaluation est null/absent, remplace par "aucune".)

Ton rôle :
- Analyser la prestation orale (forme : clarté, structure, fluidité, débit, vocabulaire ; fond : justesse du contenu et du vocabulaire technique selon la matière)
- Produire un retour pédagogique constructif, sincère, encourageant
- T'adresser à l'apprenant·e au tutoiement
- Mettre en avant des points forts réels, proposer des axes d'amélioration actionnables

Règles strictes :
1. Réponds UNIQUEMENT en JSON valide, sans texte avant ni après, sans bloc markdown
2. La structure du JSON doit être EXACTEMENT celle ci-dessous
3. score_global : note 0-10 (number, peut être décimale type 7.5). Sois honnête : 5/10 = correct mais perfectible ; 8/10 = très bonne prestation ; 10/10 = exceptionnel et rare
4. synthese : 1-2 phrases destinées à l'enseignant·e (3e personne sur l'apprenant)
5. points_forts : exactement 3 éléments. titre (3-6 mots), description (1-2 phrases au tu)
6. axes_amelioration : exactement 2 éléments. titre (3-6 mots), description (ce qui ne fonctionne pas, 1-2 phrases au tu), conseil (concret et actionnable, 1 phrase au tu)
7. transcription_corrigee : reformatée avec ponctuation, majuscules, paragraphes si pertinent. Tu peux corriger les coquilles évidentes mais NE REFORMULE PAS le propos
8. prompt_image : prompt EN ANGLAIS court (15-25 mots) pour Flux décrivant la scène/ambiance de la présentation. Style suggéré : "watercolor illustration", "soft lighting", "warm colors". Pas de texte dans l'image, pas de visage reconnaissable

ÉVALUATION DU FOND :
- Si matiere et consignes_evaluation sont fournies (différentes de "non précisée" / "aucune"), évalue aussi la justesse technique du contenu selon ces consignes
- Si tu n'es pas certain d'une affirmation technique, ne corrige pas, signale "à vérifier avec ton formateur" dans axes_amelioration
- Si aucune matière n'est précisée, concentre-toi sur la forme uniquement

Cas dégénéré :
Si la transcription est vide, inaudible ou incompréhensible (< 10 mots utiles), renvoie quand même un JSON valide avec score bas, synthèse expliquant que l'enregistrement n'a pas pu être exploité, et conseils orientés "réessaie dans un endroit calme, parle plus près du micro".

Structure JSON attendue (à respecter à la lettre) :
{
  "score_global": 7.5,
  "synthese": "<1-2 phrases pour l'enseignant>",
  "points_forts": [
    { "titre": "<court>", "description": "<au tu>" },
    { "titre": "...", "description": "..." },
    { "titre": "...", "description": "..." }
  ],
  "axes_amelioration": [
    { "titre": "<court>", "description": "<ce qui ne va pas, au tu>", "conseil": "<actionable, au tu>" },
    { "titre": "...", "description": "...", "conseil": "..." }
  ],
  "transcription_corrigee": "<texte avec ponctuation>",
  "prompt_image": "<prompt anglais 15-25 mots>"
}`;

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------
type SubmissionRow = {
  id: string;
  class_id: string;
  audio_path: string;
  status: "pending" | "processing" | "done" | "error";
};

type ClassRow = {
  matiere: string | null;
  consignes_evaluation: string | null;
};

type OpenRouterFeedback = {
  score_global: number;
  synthese: string;
  points_forts: Array<{ titre: string; description: string }>;
  axes_amelioration: Array<{ titre: string; description: string; conseil: string }>;
  transcription_corrigee: string;
  prompt_image: string;
};

type FinalFeedback = OpenRouterFeedback & {
  duree_secondes: number;
  nombre_mots: number;
  debit_mots_par_minute: number;
};

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function buildSystemPrompt(matiere: string | null, consignes: string | null): string {
  const matiereValue = matiere && matiere.trim().length > 0 ? matiere.trim() : "non précisée";
  const consignesValue = consignes && consignes.trim().length > 0 ? consignes.trim() : "aucune";
  return SYSTEM_PROMPT_TEMPLATE
    .replace("{{matiere}}", matiereValue)
    .replace("{{consignes_evaluation}}", consignesValue);
}

function buildUserMessage(args: {
  transcription: string;
  dureeSecondes: number;
  nombreMots: number;
  debit: number;
}): string {
  return `Voici la prestation orale d'un·e apprenant·e à analyser.

Métriques :
- Durée : ${args.dureeSecondes} secondes
- Nombre de mots : ${args.nombreMots}
- Débit : ${args.debit} mots/minute

Transcription brute (Whisper) :
"""
${args.transcription}
"""

Analyse cette prestation et renvoie le JSON demandé.`;
}

// -----------------------------------------------------------------------------
// Étapes pipeline
// -----------------------------------------------------------------------------
async function downloadAudio(
  supabase: SupabaseClient,
  audioPath: string,
): Promise<{ blob: Blob; filename: string }> {
  const { data, error } = await supabase
    .storage
    .from("audio-submissions")
    .createSignedUrl(audioPath, 60);

  if (error || !data?.signedUrl) {
    console.error(LOG_PREFIX, "createSignedUrl error:", error);
    throw new Error("Échec accès audio");
  }

  const res = await fetch(data.signedUrl);
  if (!res.ok) {
    console.error(LOG_PREFIX, "fetch audio status:", res.status);
    throw new Error("Échec téléchargement audio");
  }

  const blob = await res.blob();
  const filename = audioPath.split("/").pop() || "audio.webm";
  return { blob, filename };
}

async function transcribeWithGroq(
  audioBlob: Blob,
  filename: string,
  apiKey: string,
): Promise<{ text: string; duration: number }> {
  const form = new FormData();
  form.append("file", audioBlob, filename);
  form.append("model", "whisper-large-v3-turbo");
  form.append("language", "fr");
  form.append("response_format", "verbose_json");

  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(LOG_PREFIX, "Groq error", res.status, body);
    throw new Error("Échec transcription Groq");
  }

  const data = await res.json();
  const text: string = typeof data?.text === "string" ? data.text : "";
  const duration: number = typeof data?.duration === "number" ? data.duration : 0;

  if (!text || duration <= 0) {
    console.error(LOG_PREFIX, "Groq payload incomplet:", { hasText: !!text, duration });
    throw new Error("Transcription Groq vide");
  }

  return { text, duration };
}

async function generateFeedbackWithOpenRouter(
  systemPrompt: string,
  userMessage: string,
  apiKey: string,
): Promise<OpenRouterFeedback> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "deepseek/deepseek-v4-flash",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(LOG_PREFIX, "OpenRouter error", res.status, body);
    throw new Error("Échec génération feedback");
  }

  const data = await res.json();
  const content: string | undefined = data?.choices?.[0]?.message?.content;
  if (!content) {
    console.error(LOG_PREFIX, "OpenRouter: pas de content", data);
    throw new Error("Réponse OpenRouter vide");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    console.error(LOG_PREFIX, "OpenRouter JSON.parse error:", err, "content=", content);
    throw new Error("Format feedback invalide");
  }

  const feedback = parsed as OpenRouterFeedback;
  if (
    typeof feedback?.prompt_image !== "string" ||
    feedback.prompt_image.trim().length === 0
  ) {
    console.error(LOG_PREFIX, "feedback.prompt_image manquant:", feedback);
    throw new Error("Format feedback invalide");
  }

  return feedback;
}

async function generateImageWithFal(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch("https://fal.run/fal-ai/flux/schnell", {
    method: "POST",
    headers: {
      Authorization: `Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt, image_size: "square_hd" }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(LOG_PREFIX, "fal error", res.status, body);
    throw new Error("Échec génération image");
  }

  const data = await res.json();
  const url: string | undefined = data?.images?.[0]?.url;
  if (!url) {
    console.error(LOG_PREFIX, "fal: pas d'URL image", data);
    throw new Error("Image fal.ai introuvable");
  }
  return url;
}

// -----------------------------------------------------------------------------
// Handler
// -----------------------------------------------------------------------------
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Méthode non autorisée" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const groqKey = Deno.env.get("GROQ_API_KEY");
  const openrouterKey = Deno.env.get("OPENROUTER_API_KEY");
  const falKey = Deno.env.get("FAL_API_KEY");

  if (!supabaseUrl || !serviceKey || !groqKey || !openrouterKey || !falKey) {
    console.error(LOG_PREFIX, "Secrets manquants");
    return jsonResponse({ error: "Configuration serveur incomplète" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  let submissionId: string | null = null;
  let rowExists = false;

  try {
    // --- 0. Parse input ----------------------------------------------------
    let payload: { submission_id?: unknown };
    try {
      payload = await req.json();
    } catch {
      return jsonResponse({ error: "Body JSON invalide" }, 400);
    }
    if (typeof payload?.submission_id !== "string" || payload.submission_id.length === 0) {
      return jsonResponse({ error: "submission_id requis" }, 400);
    }
    submissionId = payload.submission_id;
    console.log(LOG_PREFIX, "start", submissionId);

    // --- 1. Lecture submission --------------------------------------------
    const { data: submission, error: subErr } = await supabase
      .from("submissions")
      .select("id, class_id, audio_path, status")
      .eq("id", submissionId)
      .maybeSingle<SubmissionRow>();

    if (subErr) {
      console.error(LOG_PREFIX, "SELECT submission error:", subErr);
      throw new Error("Échec lecture submission");
    }
    if (!submission) {
      return jsonResponse({ error: "Submission introuvable" }, 404);
    }
    rowExists = true;

    // --- 2. Lecture classe (matière + consignes) --------------------------
    const { data: classe, error: classErr } = await supabase
      .from("classes")
      .select("matiere, consignes_evaluation")
      .eq("id", submission.class_id)
      .maybeSingle<ClassRow>();

    if (classErr) {
      console.error(LOG_PREFIX, "SELECT classe error:", classErr);
      throw new Error("Échec lecture classe");
    }
    if (!classe) {
      throw new Error("Classe introuvable");
    }

    // --- 3 & 4. Status guards ---------------------------------------------
    if (submission.status === "processing") {
      console.log(LOG_PREFIX, "déjà en processing — refus", submissionId);
      return jsonResponse({ error: "Traitement déjà en cours" }, 409);
    }
    if (submission.status === "done" || submission.status === "error") {
      console.log(LOG_PREFIX, "[REPROCESS]", submissionId, "(prev status:", submission.status, ")");
    }

    // --- 5. UPDATE status = processing ------------------------------------
    {
      const { error } = await supabase
        .from("submissions")
        .update({ status: "processing", error: null })
        .eq("id", submissionId);
      if (error) {
        console.error(LOG_PREFIX, "UPDATE → processing error:", error);
        throw new Error("Échec mise à jour statut");
      }
    }

    // --- 6. Téléchargement audio ------------------------------------------
    const { blob, filename } = await downloadAudio(supabase, submission.audio_path);
    console.log(LOG_PREFIX, "audio téléchargé", filename, blob.size, "octets");

    // --- 7. Transcription Groq --------------------------------------------
    const { text: transcription, duration } = await transcribeWithGroq(blob, filename, groqKey);
    console.log(LOG_PREFIX, "transcription OK", duration, "s");

    // --- 8. Métriques locales ---------------------------------------------
    const dureeSecondes = Math.round(duration);
    const nombreMots = transcription.trim().length === 0
      ? 0
      : transcription.trim().split(/\s+/).length;
    const debit = duration > 0 ? Math.round((nombreMots / duration) * 60) : 0;

    // --- 9. Feedback OpenRouter (système prompt = matière + consignes) ----
    const systemPrompt = buildSystemPrompt(classe.matiere, classe.consignes_evaluation);
    const userMessage = buildUserMessage({
      transcription,
      dureeSecondes,
      nombreMots,
      debit,
    });
    const orFeedback = await generateFeedbackWithOpenRouter(systemPrompt, userMessage, openrouterKey);
    console.log(LOG_PREFIX, "feedback OpenRouter OK, score:", orFeedback.score_global);

    // --- 10. Image fal.ai --------------------------------------------------
    const avatarUrl = await generateImageWithFal(orFeedback.prompt_image, falKey);
    console.log(LOG_PREFIX, "image générée");

    // --- 11. Feedback final (feedback IA + métriques) ----------------------
    const finalFeedback: FinalFeedback = {
      ...orFeedback,
      duree_secondes: dureeSecondes,
      nombre_mots: nombreMots,
      debit_mots_par_minute: debit,
    };

    // --- 12. UPDATE done ---------------------------------------------------
    {
      const { error } = await supabase
        .from("submissions")
        .update({
          transcription,
          feedback: finalFeedback,
          avatar_url: avatarUrl,
          status: "done",
          error: null,
        })
        .eq("id", submissionId);
      if (error) {
        console.error(LOG_PREFIX, "UPDATE → done error:", error);
        throw new Error("Échec enregistrement résultat");
      }
    }

    // --- 13. Réponse -------------------------------------------------------
    console.log(LOG_PREFIX, "done", submissionId);
    return jsonResponse({ submission_id: submissionId, status: "done" });
  } catch (e) {
    const err = e as Error;
    const message = err?.message || "Erreur inattendue";
    console.error(LOG_PREFIX, "ERREUR:", message, "\n", err?.stack);

    if (rowExists && submissionId) {
      try {
        await supabase
          .from("submissions")
          .update({ status: "error", error: message })
          .eq("id", submissionId);
      } catch (updateErr) {
        console.error(LOG_PREFIX, "Échec UPDATE status=error (best-effort):", updateErr);
      }
    }

    return jsonResponse({ error: message }, 500);
  }
});
