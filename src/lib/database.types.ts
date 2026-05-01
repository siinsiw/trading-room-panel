export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          phone: string;
          telegram_id: string | null;
          role: 'admin' | 'accountant' | 'trader';
          active: boolean;
          deposit_tether: number | null;
          per_unit_deposit: number | null;
          commission_per_unit: number | null;
          approved_by: string | null;
          approved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      markets: {
        Row: {
          id: string;
          name: string;
          symbol: string;
          unit_weight: number;
          unit_label: string;
          lafz_min: number;
          lafz_max: number;
          lafz_scale: number;
          mazne_current: number;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['markets']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['markets']['Insert']>;
      };
      orders: {
        Row: {
          id: string;
          trader_id: string;
          market_id: string;
          side: 'buy' | 'sell';
          lafz: number;
          price_toman: number;
          quantity: number;
          filled: number;
          remaining: number;
          settlement_date: string;
          status: 'open' | 'partial' | 'filled' | 'cancelled';
          placed_at: string;
          cancelled_at: string | null;
          cancel_reason: string | null;
        };
        Insert: Omit<Database['public']['Tables']['orders']['Row'], 'placed_at'>;
        Update: Partial<Database['public']['Tables']['orders']['Insert']>;
      };
      trades: {
        Row: {
          id: string;
          market_id: string;
          buyer_id: string;
          seller_id: string;
          buy_order_id: string;
          sell_order_id: string;
          quantity: number;
          price_toman: number;
          settlement_date: string;
          matched_at: string;
          settled: boolean;
          settlement_id: string | null;
          buyer_pnl_toman: number | null;
          seller_pnl_toman: number | null;
          buyer_commission: number | null;
          seller_commission: number | null;
        };
        Insert: Omit<Database['public']['Tables']['trades']['Row'], 'matched_at'>;
        Update: Partial<Database['public']['Tables']['trades']['Insert']>;
      };
      settlements: {
        Row: {
          id: string;
          market_id: string;
          settlement_date: string;
          rate_toman: number;
          rate_tether: number;
          applied_at: string;
          applied_by: string;
          reversed_at: string | null;
          reversal_reason: string | null;
          snapshot_before: Json;
          total_trades_count: number;
          total_volume_units: number;
          total_commission_toman: number;
        };
        Insert: Omit<Database['public']['Tables']['settlements']['Row'], 'applied_at'>;
        Update: Partial<Database['public']['Tables']['settlements']['Insert']>;
      };
      audit_log: {
        Row: {
          id: string;
          prev_id: string | null;
          hash: string;
          actor_id: string;
          actor_role: string;
          action: string;
          payload: Json;
          timestamp: string;
        };
        Insert: never; // append-only via triggers
        Update: never;
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          title: string;
          body: string;
          read: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['notifications']['Row'], 'created_at' | 'read'>;
        Update: { read?: boolean };
      };
      system_settings: {
        Row: { key: string; value: Json; updated_at: string };
        Insert: { key: string; value: Json };
        Update: { value?: Json };
      };
    };
    Functions: {
      place_order: {
        Args: {
          p_market_id: string;
          p_side: 'buy' | 'sell';
          p_lafz: number;
          p_quantity: number;
          p_settlement_date: string;
        };
        Returns: {
          order_id: string;
          trades: Json[];
          remaining: number;
        };
      };
      cancel_order: {
        Args: { p_order_id: string; p_reason?: string };
        Returns: void;
      };
      compute_user_margin: {
        Args: {
          p_user_id: string;
          p_market_id: string;
          p_current_price: number;
          p_tether_rate: number;
        };
        Returns: {
          required_tether: number;
          available_tether: number;
          floating_pnl_tether: number;
          percentage: number;
          zone: 'safe' | 'warn' | 'risk' | 'call';
        };
      };
      apply_settlement: {
        Args: {
          p_market_id: string;
          p_settlement_date: string;
          p_rate_toman: number;
          p_rate_tether: number;
        };
        Returns: { settlement_id: string; affected_traders: number };
      };
      reverse_settlement: {
        Args: { p_settlement_id: string; p_reason: string };
        Returns: void;
      };
      update_mazne: {
        Args: { p_market_id: string; p_new_mazne: number };
        Returns: void;
      };
      approve_trader: {
        Args: {
          p_trader_id: string;
          p_deposit: number;
          p_per_unit_deposit: number;
          p_commission: number;
        };
        Returns: void;
      };
      get_settlement_preview: {
        Args: {
          p_market_id: string;
          p_settlement_date: string;
          p_test_price: number;
          p_tether_rate: number;
        };
        Returns: {
          trader_id: string;
          full_name: string;
          deposit_tether: number;
          floating_pnl_toman: number;
          floating_pnl_tether: number;
          commission_accumulated: number;
          required_tether: number;
          available_tether: number;
          percentage: number;
          zone: string;
        }[];
      };
    };
  };
};

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];

export type Profile    = Tables<'profiles'>;
export type Market     = Tables<'markets'>;
export type Order      = Tables<'orders'>;
export type Trade      = Tables<'trades'>;
export type Settlement = Tables<'settlements'>;
export type AuditEntry = Tables<'audit_log'>;
export type Notification = Tables<'notifications'>;
export type SystemSetting = Tables<'system_settings'>;
