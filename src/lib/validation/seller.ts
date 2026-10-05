import { z } from 'zod';

export const sellerRegistrationSchema = z.object({
  contact_name: z.string().min(2, 'Enter your full name'),
  business_name: z.string().min(2, 'Enter your business name'),
  email: z.string().email('Enter a valid email'),
  mobile: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'),
  address: z.string().min(5, 'Enter your business address'),
  city: z.string().min(2, 'Enter your city'),
  state: z.string().min(2, 'Enter your state'),
  pincode: z.string().regex(/^\d{6}$/, 'Enter a valid 6-digit pincode'),
  business_category: z.string().optional(),
  shop_description: z.string().max(1000).optional(),
});

export type SellerRegistrationInput = z.infer<typeof sellerRegistrationSchema>;
