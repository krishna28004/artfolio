import crypto from "crypto";

/**
 * Server-only Cloudinary management service.
 * NEVER import this file into client components.
 */
export async function deleteImageFromCloudinary(publicId: string): Promise<boolean> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const apiKey = process.env.CLOUDINARY_API_KEY;

  if (!cloudName || !apiSecret || !apiKey) {
    console.warn("[CLOUDINARY_SERVER] Missing Cloudinary server credentials for image deletion.");
    return false;
  }

  try {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const signature = crypto
      .createHash("sha1")
      .update(`public_id=${publicId}&timestamp=${timestamp}${apiSecret}`)
      .digest("hex");

    const formData = new FormData();
    formData.append("public_id", publicId);
    formData.append("timestamp", timestamp.toString());
    formData.append("api_key", apiKey);
    formData.append("signature", signature);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (response.ok) {
      console.log(`[CLOUDINARY_CLEANUP] Orphaned upload securely purged from CDN: ${publicId}`);
      return true;
    } else {
      const errJson = await response.json().catch(() => ({}));
      console.error(`[CLOUDINARY_CLEANUP_FAIL] Could not purge: ${publicId}`, errJson);
      return false;
    }
  } catch (error) {
    console.error("[CLOUDINARY_CLEANUP_FATAL]", error);
    return false;
  }
}
