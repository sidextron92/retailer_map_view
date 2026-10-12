import { supabase } from '@/lib/supabase/client';

const PAGE_SIZE = 1000;

type PublicDarkstoreTable =
  | 'rmv_tam_retailers'
  | 'rmv_retailers'
  | 'rmv_market_boundaries';

export const publicApiHeaders = {
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'no-store',
};

export function parseDarkstoreId(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;

  const darkstoreId = Number(value);
  return Number.isSafeInteger(darkstoreId) && darkstoreId > 0 ? darkstoreId : null;
}

export async function fetchAllByDarkstoreId(
  table: PublicDarkstoreTable,
  columns: string,
  darkstoreId: number
) {
  const rows: Record<string, unknown>[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .eq('darkstore_id', darkstoreId)
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;

    const page = data as unknown as Record<string, unknown>[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

export function publicJson(data: unknown, status = 200) {
  return Response.json(data, { status, headers: publicApiHeaders });
}

export function publicOptions() {
  return new Response(null, { status: 204, headers: publicApiHeaders });
}
