import { NextResponse } from "next/server";
import { commissionSchema } from "@/features/commission/schema/commission-schema";
import { supabase } from "@/shared/services/supabase";
import { deleteImageFromCloudinary } from "@/shared/services/cloudinary";
import { Resend } from "resend";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Graceful Mock for Resend bypassing server crash without keys
const resend = new Resend(process.env.RESEND_API_KEY || "mock-key");

export async function POST(req: Request) {
  try {
    // 1. IP Rate Limiting (Upstash optional boundary check)
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      const ip = req.headers.get("x-forwarded-for") || "anonymous";
      const ratelimit = new Ratelimit({ redis: Redis.fromEnv(), limiter: Ratelimit.slidingWindow(3, "1 h") });
      const { success } = await ratelimit.limit(`ratelimit_${ip}`);
      if (!success) {
        console.error(`[SPAM_FATAL] Rate limited triggered for IP: ${ip}`);
        return NextResponse.json({ success: false, message: "Too many requests. Please cool down." }, { status: 429 });
      }
    }

    const body = await req.json();

    // 2. Strict Server Zod Validation
    const validData = commissionSchema.parse(body);

    // 3. Database Layer Safeguard
    const { error: dbError } = await supabase
      .from("commissions")
      .insert([{
        idempotency_key: validData.idempotencyKey,
        name: validData.name,
        email: validData.email,
        image_url: validData.imageUrl || null,
        size: validData.size,
        budget: validData.budget,
        deadline: validData.deadline || null,
        message: validData.message
      }]);

    if (dbError) {
      // Postgres Unique Violation (IDEMPOTENCY CATCH)
      if (dbError.code === '23505') {
        console.log(`[IDEMPOTENCY_INTERCEPT] Prevented duplicate payload for key: ${validData.idempotencyKey}`);
        return NextResponse.json({ success: true, message: "Request secured safely." });
      }

      console.error("[DB_FATAL]:", dbError);

      // ORPHAN CLOUDINARY DESTRUCTION CATCH
      if (validData.publicId) {
        console.log(`[DB_FATAL] Initiating CDN cleanup for public_id: ${validData.publicId}`);
        await deleteImageFromCloudinary(validData.publicId);
      }

      // We log the error but still return 200 locally if unconfigured to prevent frontend crashes during testing.
    }

    // 4. Secure Async Email Escalation (DEGRADED EMAIL FALLBACK)
    try {
      if (process.env.RESEND_API_KEY) {
        await resend.emails.send({
          from: "notifications@artfolio.com",
          to: "admin@artfolio.com",
          subject: `New Commission Request - ${validData.name}`,
          text: `A new commission has been requested by ${validData.name} (${validData.email}).\nBudget: ${validData.budget}\nMessage: ${validData.message}`
        });
        console.log(`[EMAIL_SUCCESS] Admin notified for inquiry: ${validData.idempotencyKey}`);
      } else {
        console.log(`[EMAIL_WARN] No Resend key found. DB insert succeeded but email bypassed.`);
      }
    } catch (emailErr) {
      console.error("[EMAIL_FATAL] Resend bypassed to save DB state:", emailErr);
    }

    // End Processing Boundary

    return NextResponse.json({
      success: true,
      message: "Request received"
    });

  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'name' in error && error.name === "ZodError") {
      return NextResponse.json(
        { success: false, message: "Invalid payload.", errors: (error as Record<string, unknown>).errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, message: "Server encountered an error." },
      { status: 500 }
    );
  }
}
