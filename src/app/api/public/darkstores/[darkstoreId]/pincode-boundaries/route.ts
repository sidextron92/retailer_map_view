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
    const pincodes = await fetchAllByDarkstoreId(
      'rmv_pincode_boundaries',
      'id,pincode,pincodeName:office_name,deliveryTat:deliverytat,geometry',
      darkstoreId
    );
    return publicJson(pincodes);
  } catch (error) {
    console.error('Public pincode boundaries API failed:', error);
    return publicJson({ error: 'Failed to fetch pincode boundaries' }, 500);
  }
}

export const OPTIONS = publicOptions;
