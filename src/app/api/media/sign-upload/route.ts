import { NextResponse } from "next/server";

// All uploads use /api/media/upload for server-side content validation.
export async function POST() {
  return NextResponse.json(
    { success: false, message: "Direct signed uploads are unavailable." },
    { status: 410 }
  );
}
