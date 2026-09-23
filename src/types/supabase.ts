export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type CommissionStatus =
  | "pending"
  | "approved"
  | "payment_pending"
  | "paid"
  | "fulfilled"
  | "rejected"
  | "expired"
  | "cancelled";

export type PaymentStatus =
  | "created"
  | "attempted"
  | "captured"
  | "failed"
  | "refunded";

export interface Database {
  public: {
    Tables: {
      artworks: {
        Row: {
          id: string;
          title: string;
          artist: string;
          year: number;
          description: string | null;
          medium: string | null;
          dimensions: string | null;
          price: number | null; // Stored in integer paise (INR)
          category: string | null;
          image_url: string;
          thumbnail_url: string | null;
          texture_url: string | null;
          position_3d: Json | null;
          rotation_3d: Json | null;
          wall_identifier: string | null;
          display_order: number;
          is_available: boolean;
          is_featured: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          title: string;
          artist?: string;
          year?: number;
          description?: string | null;
          medium?: string | null;
          dimensions?: string | null;
          price?: number | null;
          category?: string | null;
          image_url: string;
          thumbnail_url?: string | null;
          texture_url?: string | null;
          position_3d?: Json | null;
          rotation_3d?: Json | null;
          wall_identifier?: string | null;
          display_order?: number;
          is_available?: boolean;
          is_featured?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          artist?: string;
          year?: number;
          description?: string | null;
          medium?: string | null;
          dimensions?: string | null;
          price?: number | null;
          category?: string | null;
          image_url?: string;
          thumbnail_url?: string | null;
          texture_url?: string | null;
          position_3d?: Json | null;
          rotation_3d?: Json | null;
          wall_identifier?: string | null;
          display_order?: number;
          is_available?: boolean;
          is_featured?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      commissions: {
        Row: {
          id: string;
          idempotency_key: string;
          reference_artwork_id: string | null;
          name: string;
          email: string;
          image_url: string | null;
          public_id: string | null;
          size: string;
          budget: string;
          deadline: string | null;
          message: string;
          status: CommissionStatus;
          price: number | null; // Stored in integer paise (INR)
          currency: string;
          admin_notes: string | null;
          checkout_token_hash: string | null;
          razorpay_order_id: string | null;
          razorpay_payment_id: string | null;
          expires_at: string | null;
          paid_at: string | null;
          fulfilled_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          idempotency_key: string;
          reference_artwork_id?: string | null;
          name: string;
          email: string;
          image_url?: string | null;
          public_id?: string | null;
          size: string;
          budget: string;
          deadline?: string | null;
          message: string;
          status?: CommissionStatus;
          price?: number | null;
          currency?: string;
          admin_notes?: string | null;
          checkout_token_hash?: string | null;
          razorpay_order_id?: string | null;
          razorpay_payment_id?: string | null;
          expires_at?: string | null;
          paid_at?: string | null;
          fulfilled_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          idempotency_key?: string;
          reference_artwork_id?: string | null;
          name?: string;
          email?: string;
          image_url?: string | null;
          public_id?: string | null;
          size?: string;
          budget?: string;
          deadline?: string | null;
          message?: string;
          status?: CommissionStatus;
          price?: number | null;
          currency?: string;
          admin_notes?: string | null;
          checkout_token_hash?: string | null;
          razorpay_order_id?: string | null;
          razorpay_payment_id?: string | null;
          expires_at?: string | null;
          paid_at?: string | null;
          fulfilled_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "commissions_reference_artwork_id_fkey";
            columns: ["reference_artwork_id"];
            isOneToOne: false;
            referencedRelation: "artworks";
            referencedColumns: ["id"];
          }
        ];
      };
      payments: {
        Row: {
          id: string;
          commission_id: string;
          razorpay_order_id: string;
          razorpay_payment_id: string | null;
          amount: number; // Stored in integer paise (INR)
          currency: string;
          status: PaymentStatus;
          method: string | null;
          error_code: string | null;
          error_description: string | null;
          event_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          commission_id: string;
          razorpay_order_id: string;
          razorpay_payment_id?: string | null;
          amount: number;
          currency?: string;
          status: PaymentStatus;
          method?: string | null;
          error_code?: string | null;
          error_description?: string | null;
          event_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          commission_id?: string;
          razorpay_order_id?: string;
          razorpay_payment_id?: string | null;
          amount?: number;
          currency?: string;
          status?: PaymentStatus;
          method?: string | null;
          error_code?: string | null;
          error_description?: string | null;
          event_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_commission_id_fkey";
            columns: ["commission_id"];
            isOneToOne: false;
            referencedRelation: "commissions";
            referencedColumns: ["id"];
          }
        ];
      };
      audit_logs: {
        Row: {
          id: string;
          actor: string;
          action: string;
          target_type: string;
          target_id: string;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor: string;
          action: string;
          target_type: string;
          target_id: string;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          actor?: string;
          action?: string;
          target_type?: string;
          target_id?: string;
          metadata?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
      artwork_views: {
        Row: {
          id: number;
          artwork_id: string;
          ip_hash: string;
          viewed_at: string;
        };
        Insert: {
          id?: number;
          artwork_id: string;
          ip_hash: string;
          viewed_at?: string;
        };
        Update: {
          id?: number;
          artwork_id?: string;
          ip_hash?: string;
          viewed_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "artwork_views_artwork_id_fkey";
            columns: ["artwork_id"];
            isOneToOne: false;
            referencedRelation: "artworks";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      commission_status: CommissionStatus;
      payment_status: PaymentStatus;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
