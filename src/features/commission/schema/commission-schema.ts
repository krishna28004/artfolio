import { z } from "zod";

export const commissionSchema = z.strictObject({
  idempotencyKey: z.string().min(1, "Idempotency key is required.").max(256),
  name: z.string().min(2, "Name must be at least 2 characters.").max(100, "Name cannot exceed 100 characters."),
  email: z.string().email("Please provide a valid email address.").max(255, "Email cannot exceed 255 characters."),
  fileClaims: z.array(z.object({ id: z.string().uuid(), token: z.string().min(32).max(128) })).max(5),
  size: z.string().min(1, "Please specify an artwork size.").max(50),
  budget: z.string().min(1, "Please select a budget range.").max(50),
  deadline: z.string().refine((value) => !value ||
    (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
      new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value &&
      value >= new Date().toISOString().slice(0, 10)), "Choose a valid future deadline.").optional(),
  message: z.string().min(10, "Please provide more detail in your message.").max(2000, "Message cannot exceed 2000 characters."),
});

export type CommissionFormData = z.infer<typeof commissionSchema>;

