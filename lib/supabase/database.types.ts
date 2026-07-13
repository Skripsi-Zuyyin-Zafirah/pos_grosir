export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      inventory: {
        Row: {
          created_at: string
          location: string | null
          product_id: string
          reorder_level: number
          stock_qty: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          location?: string | null
          product_id: string
          reorder_level?: number
          stock_qty?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          location?: string | null
          product_id?: string
          reorder_level?: number
          stock_qty?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          link: string | null
          message: string
          target_role: Database["public"]["Enums"]["user_role"] | null
          title: string
          type: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message: string
          target_role?: Database["public"]["Enums"]["user_role"] | null
          title: string
          type?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string
          target_role?: Database["public"]["Enums"]["user_role"] | null
          title?: string
          type?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          price: number
          product_id: string | null
          quantity: number
          time_weight: number | null
          unit_id: string | null
          unit_name: string | null
        }
        Insert: {
          id?: string
          order_id: string
          price?: number
          product_id?: string | null
          quantity?: number
          time_weight?: number | null
          unit_id?: string | null
          unit_name?: string | null
        }
        Update: {
          id?: string
          order_id?: string
          price?: number
          product_id?: string | null
          quantity?: number
          time_weight?: number | null
          unit_id?: string | null
          unit_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "product_units"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          assigned_staff_id: string | null
          cashier_id: string | null
          completed_at: string | null
          created_at: string
          customer_name: string | null
          dequeued_at: string | null
          enqueued_at: string | null
          ewp: number
          id: string
          order_number: string | null
          payment_proof_url: string | null
          payment_status: Database["public"]["Enums"]["payment_status"] | null
          payment_type: string | null
          priority_score: number | null
          status: Database["public"]["Enums"]["order_status"]
          total_items: number
          total_price: number
          user_id: string | null
        }
        Insert: {
          assigned_staff_id?: string | null
          cashier_id?: string | null
          completed_at?: string | null
          created_at?: string
          customer_name?: string | null
          dequeued_at?: string | null
          enqueued_at?: string | null
          ewp?: number
          id?: string
          order_number?: string | null
          payment_proof_url?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          payment_type?: string | null
          priority_score?: number | null
          status?: Database["public"]["Enums"]["order_status"]
          total_items?: number
          total_price?: number
          user_id?: string | null
        }
        Update: {
          assigned_staff_id?: string | null
          cashier_id?: string | null
          completed_at?: string | null
          created_at?: string
          customer_name?: string | null
          dequeued_at?: string | null
          enqueued_at?: string | null
          ewp?: number
          id?: string
          order_number?: string | null
          payment_proof_url?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          payment_type?: string | null
          priority_score?: number | null
          status?: Database["public"]["Enums"]["order_status"]
          total_items?: number
          total_price?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_assigned_staff_id_fkey"
            columns: ["assigned_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_cashier_id_fkey"
            columns: ["cashier_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          cashier_id: string | null
          created_at: string
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          order_id: string
          paid_at: string
        }
        Insert: {
          amount?: number
          cashier_id?: string | null
          created_at?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          order_id: string
          paid_at?: string
        }
        Update: {
          amount?: number
          cashier_id?: string | null
          created_at?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          order_id?: string
          paid_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_cashier_id_fkey"
            columns: ["cashier_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      product_units: {
        Row: {
          created_at: string | null
          id: string
          multiplier: number
          name: string
          price: number
          product_id: string | null
          time_weight: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          multiplier: number
          name: string
          price?: number
          product_id?: string | null
          time_weight?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          multiplier?: number
          name?: string
          price?: number
          product_id?: string | null
          time_weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_units_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_multi_unit: boolean | null
          name: string
          price: number
          sku: string | null
          stock: number
          unit: string | null
          waktu_pengambilan: number | null
          weight: number | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_multi_unit?: boolean | null
          name: string
          price?: number
          sku?: string | null
          stock?: number
          unit?: string | null
          waktu_pengambilan?: number | null
          weight?: number | null
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_multi_unit?: boolean | null
          name?: string
          price?: number
          sku?: string | null
          stock?: number
          unit?: string | null
          waktu_pengambilan?: number | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          full_name: string | null
          id: string
          phone_number: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          address?: string | null
          full_name?: string | null
          id: string
          phone_number?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          address?: string | null
          full_name?: string | null
          id?: string
          phone_number?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      queue_logs: {
        Row: {
          created_at: string
          dequeued_at: string | null
          enqueued_at: string
          id: string
          mode: Database["public"]["Enums"]["queue_mode"]
          order_id: string
          wait_time_seconds: number | null
        }
        Insert: {
          created_at?: string
          dequeued_at?: string | null
          enqueued_at?: string
          id?: string
          mode?: Database["public"]["Enums"]["queue_mode"]
          order_id: string
          wait_time_seconds?: number | null
        }
        Update: {
          created_at?: string
          dequeued_at?: string | null
          enqueued_at?: string
          id?: string
          mode?: Database["public"]["Enums"]["queue_mode"]
          order_id?: string
          wait_time_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "queue_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          created_at: string | null
          current_order_id: string | null
          id: string
          name: string
          status: Database["public"]["Enums"]["staff_status"] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_order_id?: string | null
          id?: string
          name: string
          status?: Database["public"]["Enums"]["staff_status"] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_order_id?: string | null
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["staff_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_current_order_id_fkey"
            columns: ["current_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          change_qty: number
          created_at: string
          id: string
          product_id: string
          reason: string
          ref_order_id: string | null
        }
        Insert: {
          change_qty: number
          created_at?: string
          id?: string
          product_id: string
          reason: string
          ref_order_id?: string | null
        }
        Update: {
          change_qty?: number
          created_at?: string
          id?: string
          product_id?: string
          reason?: string
          ref_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_ref_order_id_fkey"
            columns: ["ref_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_mutations: {
        Row: {
          id: string
          product_id: string | null
          change_qty: number
          type: string
          notes: string | null
          created_at: string
          user_id: string | null
        }
        Insert: {
          id?: string
          product_id?: string | null
          change_qty: number
          type: string
          notes?: string | null
          created_at?: string
          user_id?: string | null
        }
        Update: {
          id?: string
          product_id?: string | null
          change_qty?: number
          type?: string
          notes?: string | null
          created_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_mutations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          }
        ]
      }
      system_settings: {
        Row: {
          created_at: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          created_at?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cancel_order_transaction: {
        Args: { p_order_id: string; p_staff_id?: string }
        Returns: undefined
      }
      checkout_order: {
        Args: {
          p_customer_name: string
          p_ewp: number
          p_items: Json
          p_total_items: number
          p_total_price: number
        }
        Returns: string
      }
      finalize_order_transaction: {
        Args: { p_order_id: string; p_staff_id: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      order_status: "waiting" | "processing" | "done" | "cancelled" | "ready"
      payment_method: "tunai" | "transfer" | "qris"
      payment_status: "unpaid" | "paid"
      queue_mode: "fifo" | "priority"
      staff_status: "idle" | "busy"
      user_role: "admin" | "cashier" | "customer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      order_status: ["waiting", "processing", "done", "cancelled", "ready"],
      payment_method: ["tunai", "transfer", "qris"],
      payment_status: ["unpaid", "paid"],
      queue_mode: ["fifo", "priority"],
      staff_status: ["idle", "busy"],
      user_role: ["admin", "cashier", "customer"],
    },
  },
} as const
