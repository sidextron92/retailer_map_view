'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Retailer } from '@/types/retailer';

export function useRetailers() {
  const [retailers, setRetailers] = useState<Retailer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchRetailers() {
      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from('retailers')
          .select('*')
          .order('name', { ascending: true });

        if (fetchError) throw fetchError;

        setRetailers(data || []);
      } catch (err) {
        console.error('Error fetching retailers:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch retailers'));
      } finally {
        setLoading(false);
      }
    }

    fetchRetailers();
  }, []);

  return { retailers, loading, error, refetch: () => setLoading(true) };
}
