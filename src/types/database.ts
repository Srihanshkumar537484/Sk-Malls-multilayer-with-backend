/**
 * Hand-written type stub matching supabase/migrations/*.sql.
 *
 * Once your Supabase project is live, replace this file by running:
 *   npx supabase gen types typescript --project-id YOUR_PROJECT_REF > src/types/database.ts
 * That command needs network access to your real project, which this
 * sandbox doesn't have — do it from your own machine after deployment.
 */

export type UserRole = 'super_admin' | 'seller' | 'customer';
export type SellerStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
export type ProductStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'unpublished';
export type OrderStatus =
  | 'pending' | 'confirmed' | 'processing' | 'packed' | 'shipped'
  | 'out_for_delivery' | 'delivered' | 'cancelled'
  | 'return_requested' | 'returned' | 'refund_pending' | 'refunded';
export type PaymentMethod = 'cod' | 'online';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refund_pending' | 'refunded';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: UserRole;
          full_name: string | null;
          phone: string | null;
          avatar_url: string | null;
          is_blocked: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['profiles']['Row']> & { id: string };
        Update: Partial<Database['public']['Tables']['profiles']['Row']>;
      };
      sellers: {
        Row: {
          id: string;
          profile_id: string;
          business_name: string;
          contact_name: string;
          email: string;
          mobile: string;
          address: string;
          city: string;
          state: string;
          pincode: string;
          business_category: string | null;
          shop_description: string | null;
          logo_url: string | null;
          status: SellerStatus;
          rejection_reason: string | null;
          is_owner_store: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['sellers']['Row']>;
        Update: Partial<Database['public']['Tables']['sellers']['Row']>;
      };
      products: {
        Row: {
          id: string;
          seller_id: string;
          category_id: string | null;
          name: string;
          slug: string;
          description: string | null;
          brand: string | null;
          mrp: number;
          selling_price: number;
          status: ProductStatus;
          is_featured: boolean;
          is_bestseller: boolean;
          is_new_arrival: boolean;
          is_on_sale: boolean;
          rating_avg: number;
          rating_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['products']['Row']>;
        Update: Partial<Database['public']['Tables']['products']['Row']>;
      };
      // NOTE: remaining tables (stores, categories, product_variants, inventory,
      // carts, cart_items, orders, seller_orders, order_items, payments,
      // commission_rules, seller_ledger, payouts, reviews, wishlists, coupons,
      // returns, refunds, shipping_rules, notifications, banners,
      // store_settings, audit_logs) follow the same Row/Insert/Update pattern
      // — add them here as each feature layer is built, or generate this
      // whole file from the live schema with `supabase gen types`.
    };
    Functions: {
      checkout_cart: {
        Args: {
          p_cart_id: string;
          p_profile_id: string | null;
          p_guest_email: string | null;
          p_guest_phone: string | null;
          p_shipping_address: Record<string, unknown>;
          p_payment_method: PaymentMethod;
          p_coupon_code: string | null;
        };
        Returns: string;
      };
    };
  };
}
