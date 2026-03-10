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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      affiliate_links: {
        Row: {
          created_at: string
          created_by: string | null
          destination_url: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          link_type: Database["public"]["Enums"]["link_type"]
          offer_id: string | null
          partner_id: string
          property_address: string | null
          property_name: string | null
          tracking_code: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          destination_url?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          link_type?: Database["public"]["Enums"]["link_type"]
          offer_id?: string | null
          partner_id: string
          property_address?: string | null
          property_name?: string | null
          tracking_code: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          destination_url?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          link_type?: Database["public"]["Enums"]["link_type"]
          offer_id?: string | null
          partner_id?: string
          property_address?: string | null
          property_name?: string | null
          tracking_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_links_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_links_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          affiliate_link_id: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          message: string | null
          notes: string | null
          phone: string | null
          source_ip: string | null
          status: Database["public"]["Enums"]["contact_status"]
          updated_at: string
        }
        Insert: {
          affiliate_link_id?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          message?: string | null
          notes?: string | null
          phone?: string | null
          source_ip?: string | null
          status?: Database["public"]["Enums"]["contact_status"]
          updated_at?: string
        }
        Update: {
          affiliate_link_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          message?: string | null
          notes?: string | null
          phone?: string | null
          source_ip?: string | null
          status?: Database["public"]["Enums"]["contact_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_affiliate_link_id_fkey"
            columns: ["affiliate_link_id"]
            isOneToOne: false
            referencedRelation: "affiliate_links"
            referencedColumns: ["id"]
          },
        ]
      }
      link_clicks: {
        Row: {
          affiliate_link_id: string
          clicked_at: string
          id: string
          ip_address: string | null
          referrer: string | null
          user_agent: string | null
        }
        Insert: {
          affiliate_link_id: string
          clicked_at?: string
          id?: string
          ip_address?: string | null
          referrer?: string | null
          user_agent?: string | null
        }
        Update: {
          affiliate_link_id?: string
          clicked_at?: string
          id?: string
          ip_address?: string | null
          referrer?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "link_clicks_affiliate_link_id_fkey"
            columns: ["affiliate_link_id"]
            isOneToOne: false
            referencedRelation: "affiliate_links"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          affiliate_link_id: string | null
          contact_id: string | null
          created_at: string
          id: string
          is_read: boolean
          message: string
          title: string
          user_id: string | null
        }
        Insert: {
          affiliate_link_id?: string | null
          contact_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          title: string
          user_id?: string | null
        }
        Update: {
          affiliate_link_id?: string | null
          contact_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_affiliate_link_id_fkey"
            columns: ["affiliate_link_id"]
            isOneToOne: false
            referencedRelation: "affiliate_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          address: string | null
          area_m2: number | null
          city: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          offer_type: string | null
          price: number | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          area_m2?: number | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          offer_type?: string | null
          price?: number | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          area_m2?: number | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          offer_type?: string | null
          price?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      partners: {
        Row: {
          contact_person: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          affiliate_link_id: string | null
          closed_at: string
          closed_by: string | null
          commission_amount: number | null
          commission_paid: boolean
          contact_id: string
          created_at: string
          deal_value: number | null
          id: string
          notes: string | null
          partner_id: string | null
          property_name: string | null
        }
        Insert: {
          affiliate_link_id?: string | null
          closed_at?: string
          closed_by?: string | null
          commission_amount?: number | null
          commission_paid?: boolean
          contact_id: string
          created_at?: string
          deal_value?: number | null
          id?: string
          notes?: string | null
          partner_id?: string | null
          property_name?: string | null
        }
        Update: {
          affiliate_link_id?: string | null
          closed_at?: string
          closed_by?: string | null
          commission_amount?: number | null
          commission_paid?: boolean
          contact_id?: string
          created_at?: string
          deal_value?: number | null
          id?: string
          notes?: string | null
          partner_id?: string | null
          property_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_affiliate_link_id_fkey"
            columns: ["affiliate_link_id"]
            isOneToOne: false
            referencedRelation: "affiliate_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "employee"
      contact_status: "new" | "in_progress" | "deal_closed" | "no_deal"
      link_type: "partner" | "property"
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
      app_role: ["admin", "employee"],
      contact_status: ["new", "in_progress", "deal_closed", "no_deal"],
      link_type: ["partner", "property"],
    },
  },
} as const
