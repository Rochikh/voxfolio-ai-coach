import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AIRTABLE_TOKEN = Deno.env.get('AIRTABLE_PERSONAL_ACCESS_TOKEN');
const AIRTABLE_BASE_ID = 'appfl34Q2CiqE3Yjx';
const AIRTABLE_TABLE_NAME = 'Table 1';

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Airtable record ID format validation
const AIRTABLE_RECORD_REGEX = /^rec[a-zA-Z0-9]{14,}$/;

// Escape special characters for Airtable formula to prevent injection
function escapeAirtableValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

// Validate className format (alphanumeric, accents, spaces, hyphens, max 100 chars)
function isValidClassName(className: string): boolean {
  if (!className || className.length > 100) return false;
  return /^[a-zA-Z0-9À-ÿ\s\-_]+$/.test(className);
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let body: { recordId?: string; teacherId?: string; className?: string } = {};
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { recordId, teacherId, className } = body;

    if (!AIRTABLE_TOKEN) {
      console.error('AIRTABLE_PERSONAL_ACCESS_TOKEN not configured');
      return new Response(
        JSON.stringify({ error: 'Configuration manquante' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Case 1: Fetch single record by ID
    if (recordId) {
      // Validate recordId format
      if (!AIRTABLE_RECORD_REGEX.test(recordId)) {
        console.warn('Invalid recordId format received');
        return new Response(
          JSON.stringify({ error: 'Format recordId invalide' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Fetching record: ${recordId.substring(0, 10)}...`);
      
      const response = await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}/${recordId}`,
        {
          headers: {
            'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        console.error('Airtable API error:', response.status);
        return new Response(
          JSON.stringify({ error: 'Enregistrement introuvable' }),
          { status: response.status === 404 ? 404 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data = await response.json();
      
      // Map Airtable fields to our app format
      // Normalize "Étapes du parcours" which may be a long text or an array
      const rawEtapes = data.fields['Étapes du parcours'] ?? data.fields['Etapes'] ?? data.fields['Étapes'] ?? data.fields['Etapes du parcours'];
      let etapes: string[] = [];
      if (Array.isArray(rawEtapes)) {
        // If it's an array, process each element
        etapes = rawEtapes.flatMap((v: any) => {
          const str = String(v);
          // Check if single element contains comma-separated values
          if (str.includes(',')) {
            return str.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
          }
          return str.trim().length > 0 ? [str.trim()] : [];
        });
      } else if (typeof rawEtapes === 'string') {
        // If it's a string, split by common separators
        etapes = rawEtapes
          .split(/\r?\n|•|-|,/)
          .map((s: string) => s.trim())
          .filter((s: string) => s.length > 0);
      }

      const result = {
        id: data.id,
        prenom: data.fields['Prénom'] || '',
        objectif: data.fields['Objectif'] || '',
        etapes,
        transcription: data.fields['Transcription'] || '',
        feedback: data.fields['Feedback IA'] || '',
        image: data.fields['image']?.[0]?.url || '',
        created: data.createdTime,
      };

      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Case 2: Fetch all records for a teacher
    if (teacherId) {
      // Validate teacherId is a valid UUID
      if (!UUID_REGEX.test(teacherId)) {
        console.warn('Invalid teacherId format received');
        return new Response(
          JSON.stringify({ error: 'Format teacherId invalide' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate className if provided
      if (className && !isValidClassName(className)) {
        return new Response(
          JSON.stringify({ error: 'Format className invalide' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Fetching portfolios for teacher: ${teacherId.substring(0, 8)}...`);
      
      // Build filter formula with proper escaping to prevent injection
      const escapedTeacherId = escapeAirtableValue(teacherId);
      let filterFormula = `{ID_Enseignant}='${escapedTeacherId}'`;
      
      if (className) {
        const escapedClassName = escapeAirtableValue(className);
        filterFormula = `AND(${filterFormula},{Classe}='${escapedClassName}')`;
      }
      
      const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}?filterByFormula=${encodeURIComponent(filterFormula)}&sort[0][field]=Created&sort[0][direction]=desc`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error('Airtable API error:', response.status);
        return new Response(
          JSON.stringify({ error: 'Erreur lors de la récupération' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data = await response.json();
      console.log(`Found ${data.records?.length || 0} portfolios`);
      
      // Map Airtable records to our app format
      const records = (data.records || []).map((record: any) => ({
        id: record.id,
        prenom: record.fields['Prénom'] || '',
        objectif: record.fields['Objectif'] || '',
        image: record.fields['image']?.[0]?.url || '',
        created: record.createdTime,
        classe: record.fields['Classe'] || '',
      }));

      return new Response(
        JSON.stringify({ records }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'recordId ou teacherId requis' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error instanceof Error ? error.message : 'Unknown');
    return new Response(
      JSON.stringify({ error: 'Erreur inattendue' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});