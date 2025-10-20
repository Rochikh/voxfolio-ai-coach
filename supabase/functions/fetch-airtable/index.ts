import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AIRTABLE_TOKEN = Deno.env.get('AIRTABLE_PERSONAL_ACCESS_TOKEN');
const AIRTABLE_BASE_ID = 'appfl34Q2CiqE3Yjx';
const AIRTABLE_TABLE_NAME = 'Table 1';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { recordId, teacherId, className } = await req.json();

    if (!AIRTABLE_TOKEN) {
      console.error('AIRTABLE_PERSONAL_ACCESS_TOKEN not configured');
      return new Response(
        JSON.stringify({ error: 'Airtable token not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Case 1: Fetch single record by ID
    if (recordId) {
      console.log(`Fetching record: ${recordId}`);
      
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
        const error = await response.text();
        console.error('Airtable API error:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch record from Airtable' }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data = await response.json();
      
      // Map Airtable fields to our app format
      const result = {
        id: data.id,
        prenom: data.fields['Prénom'] || '',
        objectif: data.fields['Objectif'] || '',
        etapes: data.fields['Etapes'] || [],
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
      console.log(`Fetching portfolios for teacher: ${teacherId}`, className ? `and class: ${className}` : '');
      console.log('Full request body:', { teacherId, className });
      
      // Build filter formula with optional class filter
      let filterFormula = `{ID_Enseignant}='${teacherId}'`;
      if (className) {
        filterFormula = `AND(${filterFormula},{Classe}='${className}')`;
        console.log('Filter formula with class:', filterFormula);
      }
      
      const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}?filterByFormula=${encodeURIComponent(filterFormula)}&sort[0][field]=Created&sort[0][direction]=desc`;
      console.log('Airtable URL:', url);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('Airtable API error:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch portfolios from Airtable' }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data = await response.json();
      console.log(`Found ${data.records.length} portfolios`);
      
      // Map Airtable records to our app format
      const records = data.records.map((record: any) => ({
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
      JSON.stringify({ error: 'Missing recordId or teacherId parameter' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in fetch-airtable function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
