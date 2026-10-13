import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { getSupabaseAdmin } from "@/shared/services/supabase-admin";
import { checkDistributedRateLimit, getClientIp } from "@/shared/utils/rate-limit";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

export function validReferenceContent(bytes: Uint8Array, type: string): boolean {
  if (bytes.length < 12) return false;
  switch (type) {
    case "image/jpeg": return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    case "image/png": return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
      .every((value, index) => bytes[index] === value);
    case "image/webp": return String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
    case "application/pdf": return String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-";
    default: return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const limit = await checkDistributedRateLimit(`commission_upload_${getClientIp(req)}`, 10, 60 * 60 * 1000);
    if (!limit.success) {
      return NextResponse.json({ success: false, message: "Too many uploads. Please try again later." }, { status: 429 });
    }
    const declaredLength = Number(req.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_FILE_SIZE + 1024 * 1024) {
      return NextResponse.json({ success: false, message: "Upload exceeds the size limit." }, { status: 413 });
    }
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, message: "No valid file uploaded." }, { status: 400 });
    }
    if (file.size === 0 || file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ success: false, message: "File exceeds maximum allowable size of 10MB or is empty." }, { status: 400 });
    }
    if (!CONTENT_TYPES.has(file.type.toLowerCase())) {
      return NextResponse.json({ success: false, message: "Invalid file format. Only JPG, PNG, WebP, and PDF are allowed." }, { status: 400 });
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!validReferenceContent(bytes, file.type.toLowerCase())) {
      return NextResponse.json({ success: false, message: "File content does not match allowed image signatures or PDF header." }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const id = crypto.randomUUID();
    const token = crypto.randomBytes(32).toString("base64url");
    const claimHash = crypto.createHash("sha256").update(token).digest("hex");
    const extension = ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" } as Record<string, string>)[file.type.toLowerCase()];
    const path = `staging/${id}.${extension}`;
    const { error: storageError } = await admin.storage.from("commission-private")
      .upload(path, bytes, { contentType: file.type.toLowerCase(), upsert: false });
    if (storageError) {
      console.error("[PRIVATE_UPLOAD_STORAGE_ERROR]", storageError);
      return NextResponse.json({ success: false, message: "Private file storage is unavailable." }, { status: 503 });
    }
    const fileName = file.name.replace(/[\\/\x00-\x1f]/g, "_").slice(0, 180) || `reference.${extension}`;
    const { error: dbError } = await admin.from("commission_files").insert({
      id, commission_id: null, kind: "reference", storage_path: path,
      file_name: fileName, content_type: file.type.toLowerCase(), size_bytes: bytes.length,
      claim_hash: claimHash,
    });
    if (dbError) {
      await admin.storage.from("commission-private").remove([path]);
      console.error("[PRIVATE_UPLOAD_RECORD_ERROR]", dbError);
      return NextResponse.json({ success: false, message: "Could not record private upload." }, { status: 503 });
    }
    return NextResponse.json({ success: true, data: { id, token, name: fileName, size: bytes.length } });
  } catch (error) {
    console.error("[PRIVATE_UPLOAD_FATAL]", error);
    return NextResponse.json({ success: false, message: "Private upload could not be completed." }, { status: 500 });
  }
}
