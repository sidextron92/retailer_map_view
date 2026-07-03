'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Darkstore } from '@/types/darkstore';

export function useDarkstore(darkstoreName?: string | null) {
  const [darkstore, setDarkstore] = useState<Darkstore | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // If no darkstore name provided, don't fetch
    if (!darkstoreName) {
      setDarkstore(null);
      setLoading(false);
      setError(null);
      return;
    }

    async function fetchDarkstore() {
      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from('rmv_darkstore_locations')
          .select('*')
          .ilike('darkstore', darkstoreName!)
          .single();

        if (fetchError) throw fetchError;

        setDarkstore(data);
      } catch (err) {
        console.error('Error fetching darkstore:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch darkstore'));
        setDarkstore(null);
      } finally {
        setLoading(false);
      }
    }

    fetchDarkstore();
  }, [darkstoreName]);

  return { darkstore, loading, error };
}
