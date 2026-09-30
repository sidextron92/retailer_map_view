'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Retailer } from '@/types/retailer';

const PAGE_SIZE = 1000;

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'message' in err) {
    const message = String((err as { message?: unknown }).message || '');
    const code = 'code' in err ? String((err as { code?: unknown }).code || '') : '';

    if (code === 'PGRST202') {
      return 'The normal-market retailer RPC is not installed. Run migration 022_add_normal_market_retailers.sql in Supabase.';
    }

    if (message) return message;
  }
  return 'Failed to fetch retailers in market';
}

export function useNormalMarketRetailers(
  marketId: string | null,
  darkstore: string | null | undefined,
  enabled: boolean
) {
  const [retailers, setRetailers] = useState<Retailer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchRetailers = useCallback(async () => {
    if (!enabled || !marketId || !darkstore) {
      setRetailers([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const allRetailers: Retailer[] = [];
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error: fetchError } = await supabase
          .rpc('rmv_get_normal_retailers_in_market', {
            p_market_id: marketId,
            p_darkstore: darkstore,
          })
          .range(from, from + PAGE_SIZE - 1);

        if (fetchError) throw fetchError;

        const page = (data || []) as Retailer[];
        allRetailers.push(...page);
        hasMore = page.length === PAGE_SIZE;
        from += PAGE_SIZE;
      }

      setRetailers(allRetailers);
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      setError(new Error(message));
      setRetailers([]);
      console.error('Error fetching normal market retailers:', message);
    } finally {
      setLoading(false);
    }
  }, [darkstore, enabled, marketId]);

  useEffect(() => {
    fetchRetailers();
  }, [fetchRetailers]);

  return { retailers, loading, error, refresh: fetchRetailers };
}
