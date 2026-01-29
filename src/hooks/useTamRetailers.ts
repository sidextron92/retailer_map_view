'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { TamRetailer } from '@/types/tam-retailer';

export function useTamRetailers(darkstore?: string | null) {
  const [retailers, setRetailers] = useState<TamRetailer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // If no darkstore provided, don't fetch
    if (!darkstore) {
      setRetailers([]);
      setLoading(false);
      setError(null);
      return;
    }

    async function fetchTamRetailers() {
      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from('tam_retailers')
          .select('*')
          .ilike('darkstore', darkstore!)
          .order('created_at', { ascending: false });

        if (fetchError) throw fetchError;

        setRetailers(data || []);
      } catch (err) {
        console.error('Error fetching TAM retailers:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch TAM retailers'));
        setRetailers([]);
      } finally {
        setLoading(false);
      }
    }

    fetchTamRetailers();
  }, [darkstore]);

  // Refresh function to manually reload data
  const refresh = async () => {
    if (!darkstore) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('tam_retailers')
        .select('*')
        .ilike('darkstore', darkstore)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setRetailers(data || []);
    } catch (err) {
      console.error('Error refreshing TAM retailers:', err);
      setError(err instanceof Error ? err : new Error('Failed to refresh TAM retailers'));
    } finally {
      setLoading(false);
    }
  };

  return { retailers, loading, error, refresh };
}
