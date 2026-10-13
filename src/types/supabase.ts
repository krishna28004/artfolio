export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type CommissionStatus =
  | "pending"
  | "under_review"
  | "clarification_requested"
  | "quote_sent"
  | "quote_accepted"
  | "approved"
  | "payment_pending"
  | "paid"
  | "in_progress"
  | "revision_requested"
  | "ready_for_delivery"
  | "delivered"
  | "completed"
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

type CommissionFileRow = {
  id: string; commission_id: string | null; kind: "reference" | "deliverable";
  storage_path: string; file_name: string; content_type: string; size_bytes: number;
  claim_hash: string | null; created_at: string; delivered_at: string | null; accessed_at: string | null;
};
type CommissionEventRow = {
  id: string; commission_id: string; actor_type: "customer" | "owner" | "system" | "gateway";
  event_type: string; body: string | null; metadata: Json; created_at: string;
};
type PaymentEventRow = {
  event_id: string; event_type: string; commission_id: string | null; payment_id: string | null;
  amount: number | null; currency: string | null; state: "received" | "processed" | "ignored" | "failed";
  error_code: string | null; received_at: string; processed_at: string | null;
};
type CommissionRefundRow = {
  id: string; commission_id: string; razorpay_payment_id: string; razorpay_refund_id: string | null;
  amount: number; status: "requested" | "approved" | "initiated" | "processed" | "failed";
  reason: string | null; created_at: string; updated_at: string;
};
type NotificationJobRow = {
  id: string; commission_id: string; dedupe_key: string; recipient: string; template: string;
  state: "pending" | "sending" | "sent" | "failed"; attempts: number;
  next_attempt_at: string; last_error: string | null; created_at: string; sent_at: string | null;
};

export interface Database {
  public: {
    Tables: {
      notification_jobs: {
        Row: NotificationJobRow;
        Insert: Pick<NotificationJobRow, "commission_id" | "dedupe_key" | "recipient" | "template"> & Partial<NotificationJobRow>;
        Update: Partial<NotificationJobRow>;
        Relationships: [];
      };
      commission_files: {
        Row: CommissionFileRow;
        Insert: Pick<CommissionFileRow, "kind" | "storage_path" | "file_name" | "content_type" | "size_bytes"> & Partial<CommissionFileRow>;
        Update: Partial<CommissionFileRow>;
        Relationships: [];
      };
      commission_events: {
        Row: CommissionEventRow;
        Insert: Pick<CommissionEventRow, "commission_id" | "actor_type" | "event_type"> & Partial<CommissionEventRow>;
        Update: Partial<CommissionEventRow>;
        Relationships: [];
      };
      payment_events: {
        Row: PaymentEventRow;
        Insert: Pick<PaymentEventRow, "event_id" | "event_type"> & Partial<PaymentEventRow>;
        Update: Partial<PaymentEventRow>;
        Relationships: [];
      };
      commission_refunds: {
        Row: CommissionRefundRow;
        Insert: Pick<CommissionRefundRow, "commission_id" | "razorpay_payment_id" | "amount" | "status"> & Partial<CommissionRefundRow>;
        Update: Partial<CommissionRefundRow>;
        Relationships: [];
      };
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
          image_urls: string[];
          publication_status: "draft" | "published" | "archived";
          sale_status: "available" | "reserved" | "sold" | "not_for_sale";
          thumbnail_url: string | null;
          texture_url: string | null;
          position_3d: Json | null;
          rotation_3d: Json | null;
          wall_identifier: string | null;
          draft_wall_identifier: string | null;
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
          image_urls?: string[];
          publication_status?: "draft" | "published" | "archived";
          sale_status?: "available" | "reserved" | "sold" | "not_for_sale";
          thumbnail_url?: string | null;
          texture_url?: string | null;
          position_3d?: Json | null;
          rotation_3d?: Json | null;
          wall_identifier?: string | null;
          draft_wall_identifier?: string | null;
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
          image_urls?: string[];
          publication_status?: "draft" | "published" | "archived";
          sale_status?: "available" | "reserved" | "sold" | "not_for_sale";
          thumbnail_url?: string | null;
          texture_url?: string | null;
          position_3d?: Json | null;
          rotation_3d?: Json | null;
          wall_identifier?: string | null;
          draft_wall_identifier?: string | null;
          display_order?: number;
          is_available?: boolean;
          is_featured?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      exhibition_settings: {
        Row: { id: string; is_published: boolean; updated_at: string };
        Insert: { id: string; is_published?: boolean; updated_at?: string };
        Update: { id?: string; is_published?: boolean; updated_at?: string };
        Relationships: [];
      };
      quote_templates: {
        Row: { id: string; title: string; scope: string; terms: string; revision_allowance: number; created_at: string; updated_at: string };
        Insert: { id?: string; title: string; scope: string; terms: string; revision_allowance?: number; created_at?: string; updated_at?: string };
        Update: { id?: string; title?: string; scope?: string; terms?: string; revision_allowance?: number; created_at?: string; updated_at?: string };
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
          request_reference: string | null;
          tracking_token_hash: string | null;
          tracking_nonce: string | null;
          tracking_token_rotated_at: string | null;
          reference_claim_ids: string[];
          accepted_quote_version: number | null;
          quote_version: number;
          quote_scope: string | null;
          quote_terms: string | null;
          estimated_delivery_at: string | null;
          revision_allowance: number;
          owner_last_seen_at: string | null;
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
          request_reference?: string | null;
          tracking_token_hash?: string | null;
          tracking_nonce?: string | null;
          tracking_token_rotated_at?: string | null;
          reference_claim_ids?: string[];
          accepted_quote_version?: number | null;
          quote_version?: number;
          quote_scope?: string | null;
          quote_terms?: string | null;
          estimated_delivery_at?: string | null;
          revision_allowance?: number;
          owner_last_seen_at?: string | null;
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
          request_reference?: string | null;
          tracking_token_hash?: string | null;
          tracking_nonce?: string | null;
          tracking_token_rotated_at?: string | null;
          reference_claim_ids?: string[];
          accepted_quote_version?: number | null;
          quote_version?: number;
          quote_scope?: string | null;
          quote_terms?: string | null;
          estimated_delivery_at?: string | null;
          revision_allowance?: number;
          owner_last_seen_at?: string | null;
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
      commission_unread_counts: { Args: Record<string, never>; Returns: { commission_id: string; unread_count: number }[] };
      mark_commission_owner_read: { Args: { p_commission_id: string; p_seen_through: string }; Returns: string | null };
      set_exhibition_publication: {
        Args: { p_publish: boolean; p_actor: string };
        Returns: boolean;
      };
      is_owner_session_active: { Args: { p_session_id: string; p_user_id: string }; Returns: boolean };
      commission_business_metrics: { Args: Record<string, never>; Returns: Json };
      attach_commission_order: {
        Args: { p_commission_id: string; p_order_id: string; p_amount: number; p_currency: string };
        Returns: string;
      };
      record_commission_capture: {
        Args: { p_commission_id: string; p_order_id: string; p_payment_id: string;
          p_amount: number; p_currency: string; p_method?: string | null; p_event_id?: string | null };
        Returns: string;
      };
      record_commission_refund: {
        Args: { p_event_id: string; p_refund_id: string; p_payment_id: string;
          p_amount: number; p_processed: boolean };
        Returns: string;
      };
      accept_commission_quote: {
        Args: { p_commission_id: string; p_quote_version: number;
          p_checkout_token_hash: string; p_expires_at: string };
        Returns: string;
      };
      attach_commission_references: {
        Args: { p_commission_id: string; p_claims: Json };
        Returns: number;
      };
      release_commission_deliverables: {
        Args: { p_commission_id: string; p_actor: string; p_body?: string | null };
        Returns: string;
      };
      apply_commission_transition: {
        Args: { p_commission_id: string; p_expected_status: string; p_quote_version: number;
          p_next_status: string | null; p_action: string; p_actor_type: string; p_actor: string;
          p_body: string | null; p_metadata: Json; p_changes?: Json;
          p_notify_recipient?: string | null; p_notify_audience?: string | null };
        Returns: string;
      };
      ensure_commission_submission_events: {
        Args: { p_commission_id: string; p_owner_recipient?: string | null };
        Returns: string;
      };
      accept_commission_quote_with_notice: {
        Args: { p_commission_id: string; p_quote_version: number; p_checkout_token_hash: string;
          p_expires_at: string; p_owner_recipient?: string | null };
        Returns: string;
      };
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
