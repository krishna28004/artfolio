import { NextResponse } from "next/server";
import { commissionSchema } from "@/features/commission/schema/commission-schema";
import { supabaseAdmin } from "@/shared/services/supabase-admin";
import { deleteImageFromCloudinary } from "@/shared/services/cloudinary-server";
import { Resend } from "resend";
import { checkDistributedRateLimit, getClientIp } from "@/shared/utils/rate-limit";

export async function POST(req: Request) {
  try {
    const clientIp = getClientIp(req);

    // 1. IP Rate Limiting (Distributed Upstash Redis + Bounded Memory Fallback)
    const rateCheck = await checkDistributedRateLimit(`commission_${clientIp}`, 5, 15 * 60 * 1000);
    if (!rateCheck.success) {
      console.warn(`[SPAM_PROTECTION] Rate limit reached for IP: ${clientIp}`);
      return NextResponse.json(
        { success: false, message: "Too many commission inquiries. Please wait a few minutes before submitting again." },
        { status: 429 }
      );
    }

    const body = await req.json();

    // 2. Strict Server Zod Validation
    const validData = commissionSchema.parse(body);

    // 3. Database Layer — using Service Role client to bypass RLS for server-side insert
    const { error: dbError } = await supabaseAdmin.from("commissions").insert([
      {
        idempotency_key: validData.idempotencyKey,
        name: validData.name,
        email: validData.email,
        image_url: validData.imageUrl || null,
        size: validData.size,
        budget: validData.budget,
        deadline: validData.deadline || null,
        message: validData.message,
        status: "pending",
      },
    ]);

    if (dbError) {
      // Postgres Unique Violation (IDEMPOTENCY CATCH: code 23505)
      if (dbError.code === "23505") {
        console.info(`[IDEMPOTENT_SUBMISSION] Duplicate request ignored: ${validData.idempotencyKey}`);
        return NextResponse.json({
          success: true,
          message: "Request previously received and securely stored.",
        });
      }

      console.error("[DB_FATAL] Supabase insert failed for commission inquiry:", dbError);

      // Orphan Cloudinary cleanup if DB insert fails
      if (validData.publicId) {
        try {
          await deleteImageFromCloudinary(validData.publicId);
        } catch (cleanupErr) {
          console.error("[CDN_CLEANUP_ERROR] Failed to purge orphan image:", cleanupErr);
        }
      }

      return NextResponse.json(
        { success: false, message: "We could not save your request. Please try again shortly." },
        { status: 500 }
      );
    }

    // 4. Secure Async Email Notification (Resilient: failure does NOT roll back DB)
    if (process.env.RESEND_API_KEY) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const fromEmail = process.env.RESEND_FROM_EMAIL || "notifications@artfolio.com";
        const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || "admin@artfolio.com";

        await resend.emails.send({
          from: fromEmail,
          to: adminEmail,
          subject: `New Commission Request — ${validData.name}`,
          text: `A new commission has been submitted by ${validData.name} (${validData.email}).\n\nScale: ${validData.size}\nBudget: ${validData.budget}\nDeadline: ${validData.deadline || "None specified"}\n\nMessage:\n${validData.message}\n\nReference Image: ${validData.imageUrl || "None attached"}`,
        });
      } catch (emailErr) {
        console.error("[EMAIL_NOTIFICATION_FAIL] Resend notification failed (DB write preserved):", emailErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Commission inquiry received successfully.",
    });
  } catch (error: unknown) {
    if (error && typeof error === "object" && "name" in error && error.name === "ZodError") {
      return NextResponse.json(
        { success: false, message: "Invalid payload.", errors: (error as Record<string, unknown>).errors },
        { status: 400 }
      );
    }
    console.error("[COMMISSION_ROUTE_FATAL]", error);
    return NextResponse.json(
      { success: false, message: "Server encountered an unexpected error." },
      { status: 500 }
    );
  }
}
