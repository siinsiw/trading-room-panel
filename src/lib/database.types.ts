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
          member_group_id: string | null;
          referrer_id: string | null;
          referral_bonus_pct: number | null;
          max_open_units: number | null;
          approved_by: string | null;
          approved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        // فقط id/full_name اجباری‌اند؛ بقیه default در دیتابیس دارند یا nullable.
        Insert: {
          id: string;
          full_name: string;
          phone?: string;
          telegram_id?: string | null;
          role?: 'admin' | 'accountant' | 'trader';
          active?: boolean;
          deposit_tether?: number | null;
          per_unit_deposit?: number | null;
          commission_per_unit?: number | null;
          member_group_id?: string | null;
          referrer_id?: string | null;
          referral_bonus_pct?: number | null;
          max_open_units?: number | null;
          approved_by?: string | null;
          approved_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      member_groups: {
        Row: {
          id: string;
          name: string;
          commission_per_unit: number;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['member_groups']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['member_groups']['Insert']>;
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
          // migration 0005
          mode: 'parry' | 'margin';
          parry_threshold: number | null;
          margin_warn_pct: number;
          margin_liquidate_pct: number;
          tether_rate_today: number | null;
          tether_rate_tomorrow: number | null;
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
          kind: 'today' | 'tomorrow';
          lafz: number;
          price_toman: number;
          price_kind: 'relative' | 'absolute';
          quantity: number;
          filled: number;
          remaining: number;
          settlement_date: string;
          status: 'open' | 'partial' | 'filled' | 'cancelled' | 'expired';
          all_or_nothing: boolean;
          placed_at: string;
          expires_at: string | null;
          overridden_at: string | null;
          override_count: number;
          is_porat: boolean;
          cancelled_at: string | null;
          cancel_reason: string | null;
          telegram_msg_id: number | null;
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
          buy_order_id: string | null;
          sell_order_id: string | null;
          quantity: number;
          price_toman: number;
          settlement_date: string;
          kind: 'today' | 'tomorrow';
          trade_type: 'normal' | 'rent' | 'blocked';
          rent_block_value: number | null;
          note: string | null;
          manual: boolean;
          source: string;
          created_by: string | null;
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
          zone: 'safe' | 'warn' | 'call';
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
      create_manual_trade: {
        Args: {
          p_market_id: string;
          p_buyer_id: string;
          p_seller_id: string;
          p_quantity: number;
          p_price_toman: number;
          p_settlement_date: string;
          p_kind?: 'today' | 'tomorrow';
          p_trade_type?: 'normal' | 'rent' | 'blocked';
          p_rent_block_value?: number | null;
          p_note?: string | null;
        };
        Returns: string; // trade_id
      };
      edit_trade: {
        Args: {
          p_trade_id: string;
          p_quantity: number;
          p_price_toman: number;
          p_note?: string | null;
        };
        Returns: void;
      };
      bulk_update_traders: {
        Args: {
          p_target_group_id?: string | null;
          p_per_unit_deposit?: number | null;
          p_commission_per_unit?: number | null;
          p_max_open_units?: number | null;
        };
        Returns: number;
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
