import { NextResponse } from "next/server";
import crypto from "crypto";

export async function POST() {
  try {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      if (process.env.NODE_ENV === "production") {
        return NextResponse.json(
          { success: false, message: "Cloudinary server configuration error." },
          { status: 500 }
        );
      }
      return NextResponse.json(
        { success: false, message: "Cloudinary credentials missing in dev." },
        { status: 503 }
      );
    }

    const timestamp = Math.round(new Date().getTime() / 1000);
    const folder = "artfolio_commissions";

    // Cloudinary signature algorithm:
    // Sort parameters alphabetically, join with '=', '&', append API secret, compute SHA-1
    const stringToSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.createHash("sha1").update(stringToSign).digest("hex");

    return NextResponse.json({
      success: true,
      data: {
        signature,
        timestamp,
        apiKey,
        cloudName,
        folder,
        maxFileSize: 10 * 1024 * 1024, // 10 MB
        allowedFormats: ["jpg", "jpeg", "png", "webp"],
      },
    });
  } catch (error) {
    console.error("[SIGN_UPLOAD_FATAL]", error);
    return NextResponse.json({ success: false, message: "Failed to generate signed upload." }, { status: 500 });
  }
}
