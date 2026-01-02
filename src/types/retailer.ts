export interface Retailer {
  id: string;
  name: string;
  address: string;
  phone: string | null;
  latitude: number;
  longitude: number;
  state: string | null;
  city: string | null;
  pincode: string | null;
  last_order_date: string | null;
  retailer_status: string | null;
  sk_id: string | null;
  trader_name: string | null;
  buying_category: string | null;
  teamlead_name: string | null;
  darkstore: string | null;
  is_active: boolean;
  last_visit_date: string | null;
  next_scheduled_visit: string | null;
  notes: string | null;
}

export interface RetailerCategory {
  id: number;
  name: string;
  color_hex: string;
  icon_name: string | null;
}

export type RetailerStatusType = 'Active' | 'Idle' | 'Churn';
