// Deno Edge Function to upload audio to Storage with service role
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

    const path = `submissions/${sessionId}.${ext}`;

    const { error: uploadError } = await supabase
      .storage
      .from("audio-submissions")
      .upload(path, fileBytes, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadError) {
      return new Response(JSON.stringify({ error: uploadError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: pub } = supabase.storage
      .from("audio-submissions")
      .getPublicUrl(path);

    return new Response(
      JSON.stringify({ publicUrl: pub.publicUrl, path }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message || "Unexpected error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});