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
    const retailers = await fetchAllByDarkstoreId(
      'rmv_retailers',
      'id,shopname:name,latitude,longitude,retailer_status',
      darkstoreId
    );
    return publicJson(retailers);
  } catch (error) {
    console.error('Public retailers API failed:', error);
    return publicJson({ error: 'Failed to fetch retailers' }, 500);
  }
}

export const OPTIONS = publicOptions;
