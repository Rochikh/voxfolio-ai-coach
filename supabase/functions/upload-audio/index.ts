// Deno Edge Function to upload audio to Storage with service role
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Simple in-memory rate limiting (resets on function cold start)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_REQUESTS_PER_WINDOW = 3; // 3 uploads per 5 minutes per IP

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

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Get client IP for rate limiting
  const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() 
    || req.headers.get("cf-connecting-ip") 
    || "unknown";

  // Check rate limit
  if (!checkRateLimit(clientIP)) {
    console.log(`Rate limit exceeded for IP: ${clientIP}`);
    return new Response(JSON.stringify({ error: "Trop de requêtes. Réessayez dans quelques minutes." }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: "Missing server configuration" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const contentTypeHeader = req.headers.get("content-type") || "";

    let fileBytes: Uint8Array;
    let mimeType = "";
    let sessionId = "";

    if (contentTypeHeader.includes("application/json")) {
      // JSON body with base64 payload
      const payload = await req.json();
      const fileBase64 = payload.fileBase64 as string | undefined;
      mimeType = (payload.contentType as string | undefined) || "";
      sessionId = (payload.sessionId as string | undefined) || "";

      if (!fileBase64 || !mimeType || !sessionId) {
        return new Response(JSON.stringify({ error: "Missing fileBase64, contentType or sessionId" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Validate sessionId format
      if (!isValidSessionId(sessionId)) {
        return new Response(JSON.stringify({ error: "Invalid sessionId format" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const binary = atob(fileBase64);
      const len = binary.length;
      fileBytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) fileBytes[i] = binary.charCodeAt(i);

      if (!mimeType.startsWith("audio/")) {
        return new Response(JSON.stringify({ error: "Invalid file type" }), {
          status: 415,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (fileBytes.byteLength > 10 * 1024 * 1024) {
        return new Response(JSON.stringify({ error: "Fichier trop volumineux (max 10MB)" }), {
          status: 413,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (contentTypeHeader.includes("multipart/form-data")) {
      // Multipart form-data payload
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      sessionId = (formData.get("sessionId") as string | null)?.toString() || "";

      if (!file || !sessionId) {
        return new Response(JSON.stringify({ error: "Missing file or sessionId" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Validate sessionId format
      if (!isValidSessionId(sessionId)) {
        return new Response(JSON.stringify({ error: "Invalid sessionId format" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!file.type.startsWith("audio/")) {
        return new Response(JSON.stringify({ error: "Invalid file type" }), {
          status: 415,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (file.size > 10 * 1024 * 1024) {
        return new Response(JSON.stringify({ error: "Fichier trop volumineux (max 10MB)" }), {
          status: 413,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      mimeType = file.type;
      const ab = await file.arrayBuffer();
      fileBytes = new Uint8Array(ab);
    } else {
      return new Response(
        JSON.stringify({ error: "Unsupported Content-Type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
      console.error("Upload error:", uploadError.message);
      return new Response(JSON.stringify({ error: "Erreur lors de l'upload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: pub } = supabase.storage
      .from("audio-submissions")
      .getPublicUrl(path);

    console.log(`Successfully uploaded audio for session: ${sessionId.substring(0, 20)}...`);

    return new Response(
      JSON.stringify({ publicUrl: pub.publicUrl, path }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Unexpected error:", (e as Error).message);
    return new Response(
      JSON.stringify({ error: "Erreur inattendue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});