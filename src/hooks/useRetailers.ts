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

        // Fetch all retailers by paginating through results
        let allRetailers: Retailer[] = [];
        let from = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
          const { data, error: fetchError } = await supabase
            .from('retailers')
            .select('*')
            .order('name', { ascending: true })
            .range(from, from + pageSize - 1);

          if (fetchError) throw fetchError;

          if (data && data.length > 0) {
            allRetailers = [...allRetailers, ...data];
            from += pageSize;

            // If we got less than pageSize, we've reached the end
            if (data.length < pageSize) {
              hasMore = false;
            }
          } else {
            hasMore = false;
          }
        }

        setRetailers(allRetailers);
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
