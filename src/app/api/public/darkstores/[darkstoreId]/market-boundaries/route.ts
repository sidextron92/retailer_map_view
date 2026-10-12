import {
  fetchAllByDarkstoreId,
  parseDarkstoreId,
  publicJson,
  publicOptions,
} from '@/lib/supabase/public-api';

interface RouteContext {
  params: Promise<{ darkstoreId: string }>;
}

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: RouteContext) {
  const darkstoreId = parseDarkstoreId((await params).darkstoreId);
  if (darkstoreId === null) {
    return publicJson({ error: 'darkstoreId must be a positive integer' }, 400);
  }

  try {
    const markets = await fetchAllByDarkstoreId(
      'rmv_market_boundaries',
      'id,marketname:name,geometry',
      darkstoreId
    );
    return publicJson(markets);
  } catch (error) {
    console.error('Public market boundaries API failed:', error);
    return publicJson({ error: 'Failed to fetch market boundaries' }, 500);
  }
}

export const OPTIONS = publicOptions;
