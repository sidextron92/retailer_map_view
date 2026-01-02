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
      retailers: {
        Row: {
          id: string
          name: string
          address: string
          phone: string | null
          latitude: number
          longitude: number
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
      retailer_categories: {
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
    }
  }
}
