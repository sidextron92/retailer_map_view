// This file will be auto-generated from your Supabase schema
// Run: npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/lib/supabase/types.ts

// For now, we're using the types from src/types/retailer.ts
// Once you run the migration and have data, you can generate this file

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      rmv_retailers: {
        Row: {
          id: string
          name: string
          address: string
          phone: string | null
          latitude: number
          longitude: number
          userid: number | null
          state: string | null
          city: string | null
          pincode: string | null
          last_order_date: string | null
          retailer_status: string | null
          sk_id: string | null
          trader_name: string | null
          buying_category: string | null
          teamlead_name: string | null
          darkstore: string | null
          is_active: boolean
          last_visit_date: string | null
          next_scheduled_visit: string | null
          notes: string | null
        }
        Insert: {
          id?: string
          name: string
          address: string
          phone?: string | null
          latitude: number
          longitude: number
          userid?: number | null
          state?: string | null
          city?: string | null
          pincode?: string | null
          last_order_date?: string | null
          retailer_status?: string | null
          sk_id?: string | null
          trader_name?: string | null
          buying_category?: string | null
          teamlead_name?: string | null
          darkstore?: string | null
          is_active?: boolean
          last_visit_date?: string | null
          next_scheduled_visit?: string | null
          notes?: string | null
        }
        Update: {
          id?: string
          name?: string
          address?: string
          phone?: string | null
          latitude?: number
          longitude?: number
          userid?: number | null
          state?: string | null
          city?: string | null
          pincode?: string | null
          last_order_date?: string | null
          retailer_status?: string | null
          sk_id?: string | null
          trader_name?: string | null
          buying_category?: string | null
          teamlead_name?: string | null
          darkstore?: string | null
          is_active?: boolean
          last_visit_date?: string | null
          next_scheduled_visit?: string | null
          notes?: string | null
        }
      }
      rmv_retailer_categories: {
        Row: {
          id: number
          name: string
          color_hex: string
          icon_name: string | null
        }
        Insert: {
          id?: number
          name: string
          color_hex: string
          icon_name?: string | null
        }
        Update: {
          id?: number
          name?: string
          color_hex?: string
          icon_name?: string | null
        }
      }
      rmv_pincode_boundaries: {
        Row: {
          id: number
          pincode: string
          office_name: string | null
          district: string | null
          state: string | null
          geometry: unknown
          created_at: string | null
          deliverytat: number | null
        }
        Insert: {
          id?: number
          pincode: string
          office_name?: string | null
          district?: string | null
          state?: string | null
          geometry: unknown
          created_at?: string | null
          deliverytat?: number | null
        }
        Update: {
          id?: number
          pincode?: string
          office_name?: string | null
          district?: string | null
          state?: string | null
          geometry?: unknown
          created_at?: string | null
          deliverytat?: number | null
        }
      }
      rmv_darkstore_locations: {
        Row: {
          id: string
          darkstore: string
          address: string
          latitude: number
          longitude: number
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          darkstore: string
          address: string
          latitude: number
          longitude: number
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          darkstore?: string
          address?: string
          latitude?: number
          longitude?: number
          created_at?: string | null
          updated_at?: string | null
        }
      }
      rmv_tam_retailers: {
        Row: {
          id: string
          shop_name: string | null
          phone_number: string | null
          shop_photo_url: string
          category_tags: Json | null
          latitude: number
          longitude: number
          location_accuracy: number | null
          pincode: string
          darkstore: string
          user_agent: string | null
          device_info: Json | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          shop_name?: string | null
          phone_number?: string | null
          shop_photo_url: string
          category_tags?: Json | null
          latitude: number
          longitude: number
          location_accuracy?: number | null
          pincode: string
          darkstore: string
          user_agent?: string | null
          device_info?: Json | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          shop_name?: string | null
          phone_number?: string | null
          shop_photo_url?: string
          category_tags?: Json | null
          latitude?: number
          longitude?: number
          location_accuracy?: number | null
          pincode?: string
          darkstore?: string
          user_agent?: string | null
          device_info?: Json | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
    }
    Functions: {
      rmv_get_pincodes_by_radius: {
        Args: {
          center_lng: number
          center_lat: number
          radius_km: number
          zoom_level?: number
        }
        Returns: {
          id: number
          pincode: string
          office_name: string | null
          district: string | null
          state: string | null
          geometry: unknown
          deliverytat: number | null
        }[]
      }
      rmv_get_pincodes_in_viewport: {
        Args: {
          min_lng: number
          min_lat: number
          max_lng: number
          max_lat: number
          zoom_level?: number
        }
        Returns: {
          id: number
          pincode: string
          office_name: string | null
          district: string | null
          state: string | null
          geometry: unknown
        }[]
      }
    }
  }
}
