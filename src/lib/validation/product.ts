import { z } from 'zod';

export const variantSchema = z.object({
  size: z.string().optional(),
  color: z.string().optional(),
  stock: z.coerce.number().int().min(0, 'Stock cannot be negative'),
});

export const productSchema = z
  .object({
    name: z.string().min(3, 'Enter a product name'),
    category_id: z.string().uuid('Choose a category'),
    brand: z.string().optional(),
    description: z.string().min(10, 'Add a short description'),
    mrp: z.coerce.number().positive('MRP must be greater than 0'),
    selling_price: z.coerce.number().positive('Price must be greater than 0'),
    fabric: z.string().optional(),
    fit: z.string().optional(),
    weight_grams: z.coerce.number().int().positive().optional(),
    tags: z.string().optional(), // comma-separated in the form, split before saving
    shipping_note: z.string().optional(),
    return_note: z.string().optional(),
    image_urls: z.array(z.string().url()).min(1, 'Upload at least one photo'),
    variants: z.array(variantSchema).min(1, 'Add at least one size/color/stock row'),
  })
  .refine((data) => data.selling_price <= data.mrp, {
    message: 'Selling price cannot be greater than MRP',
    path: ['selling_price'],
  });

export type ProductInput = z.infer<typeof productSchema>;
