export interface TamRetailer {
  id: string;
  shop_name: string | null;
  shop_photo_url: string;
  category_tags: string[];
  latitude: number;
  longitude: number;
  location_accuracy: number | null;
  pincode: string;
  darkstore: string;
  user_agent: string | null;
  device_info: any | null;
  created_at: string | null;
  updated_at: string | null;
}

export const CATEGORY_OPTIONS = [
  'Men Footwear',
  'Women Footwear',
  'Men Westernwear',
  'Women Westernwear',
  'Men Ethnicwear',
  'Women Ethnicwear',
] as const;

export type CategoryOption = typeof CATEGORY_OPTIONS[number];
