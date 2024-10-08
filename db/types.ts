export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type TableNames = keyof Database["public"]["Tables"];

export type Database = {
  public: {
    Tables: {
      disc_info: {
        Row: {
          bead: string
          brand: string
          diameter: number
          fade: number
          glide: number
          height: number
          id: number
          inside_rim_diameter: number
          mold: string
          rim_configuration: number
          rim_depth: number
          rim_diameter_ratio: number
          rim_thickness: number
          speed: number
          stability: number
          turn: number
          type: string
        }
        Insert: {
          bead: string
          brand: string
          diameter: number
          fade: number
          glide: number
          height: number
          id: number
          inside_rim_diameter: number
          mold: string
          rim_configuration: number
          rim_depth: number
          rim_diameter_ratio: number
          rim_thickness: number
          speed: number
          stability: number
          turn: number
          type: string
        }
        Update: {
          bead?: string
          brand?: string
          diameter?: number
          fade?: number
          glide?: number
          height?: number
          id?: number
          inside_rim_diameter?: number
          mold?: string
          rim_configuration?: number
          rim_depth?: number
          rim_diameter_ratio?: number
          rim_thickness?: number
          speed?: number
          stability?: number
          turn?: number
          type?: string
        }
        Relationships: []
      }
      discs: {
        Row: {
          details_url: string
          id: string
          disc_info_id: number
          img_src: string
          listing: string
          price: number
          retailer: string
          type: string
        }
        Insert: {
          details_url: string
          id?: string
          disc_info_id: number
          img_src: string
          listing: string
          price: number
          retailer: string
          type: string
        }
        Update: {
          details_url?: string
          id?: string
          disc_info_id: number
          img_src?: string
          listing?: string
          price?: number
          retailer?: string
          type?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      disc_search: {
        Args: {
          query: string
          manufacturer_filter: string[]
          model_filter: string[]
          type_filter: string[]
          page: number
          sort: string
        }
        Returns: {
          details_url: string
          listing: string
          img_src: string
          price: number
          model: string
          manufacturer: string
          retailer: string
        }[]
      }
      disc_search_results_count:
        | {
            Args: {
              query: string
              manufacturer_filter: string[]
              model_filter: string[]
            }
            Returns: number
          }
        | {
            Args: {
              query: string
              manufacturer_filter: string[]
              model_filter: string[]
              type_filter: string[]
            }
            Returns: number
          }
      get_manufacturer_counts:
        | {
            Args: {
              query: string
            }
            Returns: {
              manufacturer: string
              count: number
            }[]
          }
        | {
            Args: {
              query: string
              type_filter: string[]
            }
            Returns: {
              manufacturer: string
              count: number
            }[]
          }
      get_model_counts:
        | {
            Args: {
              query: string
              manufacturer_filter: string[]
            }
            Returns: {
              model: string
              count: number
            }[]
          }
        | {
            Args: {
              query: string
              manufacturer_filter: string[]
              type_filter: string[]
            }
            Returns: {
              model: string
              count: number
            }[]
          }
      get_type_counts: {
        Args: {
          query: string
          manufacturer_filter: string[]
          model_filter: string[]
        }
        Returns: {
          type: string
          count: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never
