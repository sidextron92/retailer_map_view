'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { TamRetailer } from '@/types/tam-retailer';

export function useMarketRetailers(marketId: string | null, darkstore: string | null | undefined) {
  const [retailers, setRetailers] = useState<TamRetailer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchRetailers = useCallback(async () => {
    if (!marketId || !darkstore) {
      setRetailers([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .rpc('rmv_get_retailers_in_market', {
          p_market_id: marketId,
          p_darkstore: darkstore,
        });

      if (fetchError) throw fetchError;

      setRetailers((data || []) as TamRetailer[]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch retailers in market';
      setError(new Error(message));
      console.error('Error fetching market retailers:', err);
    } finally {
      setLoading(false);
    }
  }, [marketId, darkstore]);

  useEffect(() => {
    fetchRetailers();
  }, [fetchRetailers]);

  return { retailers, loading, error, refresh: fetchRetailers };
}
