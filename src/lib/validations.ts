import { z } from "zod";

export const commissionSchema = z.object({
  idempotencyKey: z.string(),
  name: z.string().min(2, "Name must be at least 2 characters."),
  email: z.string().email("Please provide a valid email address."),
  imageUrl: z.string().optional(),
  publicId: z.string().optional(), // For Cloudinary orphan destruction
  size: z.string().min(1, "Please specify an artwork size."),
  budget: z.string().min(1, "Please select a budget range."),
  deadline: z.string().optional(),
  message: z.string().min(10, "Please provide more detail in your message.")
});

export type CommissionFormData = z.infer<typeof commissionSchema>;
