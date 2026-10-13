import { z } from "zod";

export const artworkInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  artist: z.string().trim().min(1).max(200),
  year: z.number().int().min(1900).max(2100),
  description: z.string().max(2000),
  medium: z.string().max(200),
  dimensions: z.string().max(100),
  priceInRupees: z.number().int().positive().nullable(),
  category: z.string().max(100),
  primaryIndex: z.number().int().min(0).max(7),
  publicationStatus: z.enum(["draft", "published"]),
  saleStatus: z.enum(["available", "reserved", "sold", "not_for_sale"]),
  displayOrder: z.number().int().min(0).default(0),
  slotId: z.string().max(50).nullable().default(null),
});
