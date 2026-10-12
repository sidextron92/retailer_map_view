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
      'rmv_tam_retailers',
      'id,shopname:shop_name,latitude,longitude,pincode',
      darkstoreId
    );
    return publicJson(retailers);
  } catch (error) {
    console.error('Public TAM retailers API failed:', error);
    return publicJson({ error: 'Failed to fetch TAM retailers' }, 500);
  }
}

export const OPTIONS = publicOptions;
