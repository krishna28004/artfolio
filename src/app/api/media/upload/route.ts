import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Validates image buffer magic bytes against trusted image headers.
 */
function isValidImageMagicBytes(buffer: Uint8Array): boolean {
  if (buffer.length < 12) return false;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return true;
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return true;
  }

  // WebP: RIFF ... WEBP
  const isRiff =
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46;
  const isWebp =
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50;

  return isRiff && isWebp;
}

export async function POST(req: NextRequest) {
  try {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      console.error("[CLOUDINARY_CONFIG_FATAL] Cloudinary server credentials missing.");
      return NextResponse.json(
        { success: false, message: "Media storage is temporarily unavailable." },
        { status: 503 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { success: false, message: "No valid image file uploaded." },
        { status: 400 }
      );
    }

    // 1. Strict Server-Side Size Enforcement
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, message: "File exceeds maximum allowable size of 10MB." },
        { status: 400 }
      );
    }

    // 2. Strict MIME Type Enforcement (rejects SVGs, executables, PDFs, etc.)
    if (!ALLOWED_MIME_TYPES.has(file.type.toLowerCase())) {
      return NextResponse.json(
        { success: false, message: "Invalid file format. Only JPG, PNG, and WebP images are allowed." },
        { status: 400 }
      );
    }

    // 3. Cryptographic Magic Bytes Verification (content sniffing prevention)
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    if (!isValidImageMagicBytes(bytes)) {
      return NextResponse.json(
        { success: false, message: "File content does not match allowed image signatures." },
        { status: 400 }
      );
    }

    // 4. Server-Controlled Secure Upload to Cloudinary
    const timestamp = Math.round(new Date().getTime() / 1000);
    const folder = "artfolio_commissions";
    const publicId = `ref_${crypto.randomUUID().replace(/-/g, "")}`;

    // Cloudinary signature for controlled parameters
    const stringToSign = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.createHash("sha1").update(stringToSign).digest("hex");

    const uploadFormData = new FormData();
    const blob = new Blob([bytes], { type: file.type });
    uploadFormData.append("file", blob, file.name);
    uploadFormData.append("api_key", apiKey);
    uploadFormData.append("timestamp", timestamp.toString());
    uploadFormData.append("signature", signature);
    uploadFormData.append("folder", folder);
    uploadFormData.append("public_id", publicId);

    const cloudinaryRes = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: "POST",
        body: uploadFormData,
      }
    );

    if (!cloudinaryRes.ok) {
      const errData = await cloudinaryRes.json().catch(() => ({}));
      console.error("[CLOUDINARY_SERVER_UPLOAD_FAIL]", errData);
      return NextResponse.json(
        { success: false, message: "Failed to securely store image." },
        { status: 502 }
      );
    }

    const data = await cloudinaryRes.json();

    return NextResponse.json({
      success: true,
      data: {
        url: data.secure_url,
        publicId: data.public_id,
      },
    });
  } catch (error) {
    console.error("[MEDIA_UPLOAD_FATAL]", error);
    return NextResponse.json(
      { success: false, message: "Internal server error during upload." },
      { status: 500 }
    );
  }
}
