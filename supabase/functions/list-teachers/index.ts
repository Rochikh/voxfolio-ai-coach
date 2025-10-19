import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Fetching list of teachers...');

    // Get all users with the 'enseignant' role
    const { data: teacherRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'enseignant');

    if (rolesError) {
      console.error('Error fetching teacher roles:', rolesError);
      throw rolesError;
    }

    if (!teacherRoles || teacherRoles.length === 0) {
      return new Response(
        JSON.stringify({ teachers: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get teacher profiles
    const teacherIds = teacherRoles.map(role => role.user_id);
    const { data: teachers, error: profilesError } = await supabase
      .from('profiles')
      .select('id, prenom, nom')
      .in('id', teacherIds)
      .order('nom');

    if (profilesError) {
      console.error('Error fetching teacher profiles:', profilesError);
      throw profilesError;
    }

    console.log(`Found ${teachers?.length || 0} teachers`);

    return new Response(
      JSON.stringify({ teachers: teachers || [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in list-teachers function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
