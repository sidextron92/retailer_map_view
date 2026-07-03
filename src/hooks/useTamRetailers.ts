'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { TamRetailer } from '@/types/tam-retailer';

function getErrorMessage(err: unknown, fallback: string) {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message?: unknown }).message || fallback);
  }
  return fallback;
}

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
          .from('rmv_tam_retailers')
          .select('*')
          .ilike('darkstore', darkstore!)
          .order('created_at', { ascending: false });

        if (fetchError) throw fetchError;

        setRetailers(data || []);
      } catch (err) {
        console.error('Error fetching TAM retailers:', JSON.stringify(err, null, 2));
        setError(new Error(getErrorMessage(err, 'Failed to fetch TAM retailers')));
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
        .from('rmv_tam_retailers')
        .select('*')
        .ilike('darkstore', darkstore)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setRetailers(data || []);
    } catch (err) {
      console.error('Error refreshing TAM retailers:', JSON.stringify(err, null, 2));
      setError(new Error(getErrorMessage(err, 'Failed to refresh TAM retailers')));
    } finally {
      setLoading(false);
    }
  };

  return { retailers, loading, error, refresh };
}
