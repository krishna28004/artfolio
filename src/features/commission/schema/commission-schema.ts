import { z } from "zod";

export const commissionSchema = z.object({
  idempotencyKey: z.string().min(1, "Idempotency key is required.").max(256),
  name: z.string().min(2, "Name must be at least 2 characters.").max(100, "Name cannot exceed 100 characters."),
  email: z.string().email("Please provide a valid email address.").max(255, "Email cannot exceed 255 characters."),
  imageUrl: z.string().url("Invalid image URL.").optional().or(z.literal("")),
  publicId: z.string().max(255).optional(),
  size: z.string().min(1, "Please specify an artwork size.").max(50),
  budget: z.string().min(1, "Please select a budget range.").max(50),
  deadline: z.string().max(100).optional(),
  message: z.string().min(10, "Please provide more detail in your message.").max(2000, "Message cannot exceed 2000 characters."),
});

export type CommissionFormData = z.infer<typeof commissionSchema>;

