import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type DashboardStats = {
  weeklyDone: number;
  inProgress: number;
  errors: number;
  loading: boolean;
};

export function useDashboardStats(): DashboardStats {
  const { user } = useAuth();
  const [weeklyDone, setWeeklyDone] = useState(0);
  const [inProgress, setInProgress] = useState(0);
  const [errors, setErrors] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const load = async () => {
      const sevenDaysAgo = new Date(
        Date.now() - 7 * 24 * 60 * 60 * 1000,
      ).toISOString();

      const [doneRes, inProgressRes, errorRes] = await Promise.all([
        supabase
          .from('submissions')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'done')
          .gte('created_at', sevenDaysAgo),
        supabase
          .from('submissions')
          .select('*', { count: 'exact', head: true })
          .in('status', ['pending', 'processing']),
        supabase
          .from('submissions')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'error'),
      ]);

      if (cancelled) return;

      if (doneRes.error) console.error('weeklyDone count failed:', doneRes.error);
      if (inProgressRes.error) console.error('inProgress count failed:', inProgressRes.error);
      if (errorRes.error) console.error('errors count failed:', errorRes.error);

      setWeeklyDone(doneRes.count ?? 0);
      setInProgress(inProgressRes.count ?? 0);
      setErrors(errorRes.count ?? 0);
      setLoading(false);
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [user]);

  return { weeklyDone, inProgress, errors, loading };
}
