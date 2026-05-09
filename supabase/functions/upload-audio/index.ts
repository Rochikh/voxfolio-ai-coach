// Deno Edge Function: upload audio to Storage with service role,
// insert a `submissions` row, then trigger `process-submission` in
// fire-and-forget (via EdgeRuntime.waitUntil so the request survives
// after we return 202 to the client).
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const LOG_PREFIX = "[upload-audio]";

const corsHeaders: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Simple in-memory rate limiting (resets on function cold start)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_REQUESTS_PER_WINDOW = 3; // 3 uploads per 5 minutes per IP

const UUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function checkRateLimit(clientIP: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(clientIP);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(clientIP, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }

  record.count++;
  return true;
}

// Validate sessionId format (alphanumeric, hyphens, underscores, max 100 chars)
function isValidSessionId(sessionId: string): boolean {
  if (!sessionId || sessionId.length > 100) return false;
  return /^[a-zA-Z0-9_-]+$/.test(sessionId);
}

function isValidUuid(id: string): boolean {
  return UUID_REGEX.test(id);
}

// Trim, enforce 1..100 chars. Returns the cleaned name or null if invalid.
function cleanStudentName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > 100) return null;
  return trimmed;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  // Get client IP for rate limiting
  const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("cf-connecting-ip")
    || "unknown";

  if (!checkRateLimit(clientIP)) {
    console.log(LOG_PREFIX, "rate limit exceeded for IP:", clientIP);
    return jsonResponse(
      { error: "Trop de requêtes. Réessayez dans quelques minutes." },
      429,
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    // anonKey is a built-in env var in Supabase Edge Functions runtime.
    // Used only for the HTTP trigger below (the gateway rejects service_role
    // in Authorization headers on direct invocation).
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceKey || !anonKey) {
      console.error(LOG_PREFIX, "missing server configuration");
      return jsonResponse({ error: "Missing server configuration" }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const contentTypeHeader = req.headers.get("content-type") || "";

    let fileBytes: Uint8Array;
    let mimeType = "";
    let sessionId = "";
    let studentNameRaw: unknown;
    let classIdRaw: unknown;

    if (contentTypeHeader.includes("application/json")) {
      // JSON body with base64 payload
      const payload = await req.json();
      const fileBase64 = payload.fileBase64 as string | undefined;
      mimeType = (payload.contentType as string | undefined) || "";
      sessionId = (payload.sessionId as string | undefined) || "";
      studentNameRaw = payload.student_name;
      classIdRaw = payload.class_id;

      if (!fileBase64 || !mimeType || !sessionId) {
        return jsonResponse(
          { error: "Missing fileBase64, contentType or sessionId" },
          400,
        );
      }

      if (!isValidSessionId(sessionId)) {
        return jsonResponse({ error: "Invalid sessionId format" }, 400);
      }

      const binary = atob(fileBase64);
      const len = binary.length;
      fileBytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) fileBytes[i] = binary.charCodeAt(i);

      if (!mimeType.startsWith("audio/")) {
        return jsonResponse({ error: "Invalid file type" }, 415);
      }

      if (fileBytes.byteLength > 10 * 1024 * 1024) {
        return jsonResponse({ error: "Fichier trop volumineux (max 10MB)" }, 413);
      }
    } else if (contentTypeHeader.includes("multipart/form-data")) {
      // Multipart form-data payload
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      sessionId = (formData.get("sessionId") as string | null)?.toString() || "";
      studentNameRaw = (formData.get("student_name") as string | null)?.toString();
      classIdRaw = (formData.get("class_id") as string | null)?.toString();

      if (!file || !sessionId) {
        return jsonResponse({ error: "Missing file or sessionId" }, 400);
      }

      if (!isValidSessionId(sessionId)) {
        return jsonResponse({ error: "Invalid sessionId format" }, 400);
      }

      if (!file.type.startsWith("audio/")) {
        return jsonResponse({ error: "Invalid file type" }, 415);
      }

      if (file.size > 10 * 1024 * 1024) {
        return jsonResponse({ error: "Fichier trop volumineux (max 10MB)" }, 413);
      }

      mimeType = file.type;
      const ab = await file.arrayBuffer();
      fileBytes = new Uint8Array(ab);
    } else {
      return jsonResponse({ error: "Unsupported Content-Type" }, 400);
    }

    // student_name + class_id are required to create the submission row.
    const studentName = cleanStudentName(studentNameRaw);
    if (!studentName) {
      return jsonResponse(
        { error: "student_name requis (1-100 caractères)" },
        400,
      );
    }
    if (typeof classIdRaw !== "string" || !isValidUuid(classIdRaw)) {
      return jsonResponse({ error: "class_id requis (UUID)" }, 400);
    }
    const classId = classIdRaw;

    const ext = mimeType.includes("webm")
      ? "webm"
      : mimeType.includes("mpeg") || mimeType.includes("mp3")
      ? "mp3"
      : mimeType.includes("wav")
      ? "wav"
      : mimeType.includes("ogg")
      ? "ogg"
      : "webm";

    const path = `${sessionId}.${ext}`;

    const { error: uploadError } = await supabase
      .storage
      .from("audio-submissions")
      .upload(path, fileBytes, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadError) {
      console.error(LOG_PREFIX, "upload error:", uploadError.message);
      return jsonResponse({ error: "Erreur lors de l'upload" }, 400);
    }

    console.log(
      LOG_PREFIX,
      "audio uploaded for session:",
      sessionId.substring(0, 20) + "...",
    );

    // Insert the submission row. On failure, rollback the storage upload
    // (best-effort) so we don't accumulate orphan files.
    const { data: inserted, error: insertError } = await supabase
      .from("submissions")
      .insert({
        student_name: studentName,
        class_id: classId,
        audio_path: path,
        status: "pending",
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      console.error(
        LOG_PREFIX,
        "INSERT submissions error:",
        insertError?.message,
      );
      try {
        await supabase.storage.from("audio-submissions").remove([path]);
      } catch (rollbackErr) {
        console.error(
          LOG_PREFIX,
          "rollback storage failed (best-effort):",
          (rollbackErr as Error).message,
        );
      }
      return jsonResponse(
        { error: "Erreur lors de la création de la submission" },
        500,
      );
    }

    const submissionId = inserted.id as string;
    console.log(LOG_PREFIX, "submission created:", submissionId);

    // Fire-and-forget: trigger process-submission. EdgeRuntime.waitUntil
    // keeps the worker alive long enough for the outbound fetch to start
    // even though we return immediately to the client.
    const processUrl = `${supabaseUrl}/functions/v1/process-submission`;
    const triggerPromise = fetch(processUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${anonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ submission_id: submissionId }),
    })
      .then((res) => {
        console.log(
          LOG_PREFIX,
          "process-submission triggered, status:",
          res.status,
        );
      })
      .catch((err) => {
        console.error(
          LOG_PREFIX,
          "process-submission trigger failed:",
          (err as Error).message,
        );
      });

    // @ts-ignore — EdgeRuntime is provided by the Supabase Edge runtime
    if (typeof EdgeRuntime !== "undefined" && typeof EdgeRuntime.waitUntil === "function") {
      // @ts-ignore
      EdgeRuntime.waitUntil(triggerPromise);
    }

    return jsonResponse(
      { submission_id: submissionId, status: "pending", path },
      202,
    );
  } catch (e) {
    console.error(LOG_PREFIX, "unexpected error:", (e as Error).message);
    return jsonResponse({ error: "Erreur inattendue" }, 500);
  }
});
