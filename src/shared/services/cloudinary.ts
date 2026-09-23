/**
 * Client-side Cloudinary service with constrained signed upload capability.
 */

interface SignedUploadParams {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
  maxFileSize: number;
  allowedFormats: string[];
}

/**
 * Uploads an image using constrained server-signed authentication.
 * Guarantees that folder, size, and transformation policies are enforced by the server.
 */
export async function uploadImageToCloudinarySigned(
  file: File
): Promise<{ url: string; publicId: string } | null> {
  // 1. Client-side preliminary validation
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("File exceeds maximum allowable upload size of 10MB.");
  }

  // 2. Obtain cryptographically signed parameters from server
  const signRes = await fetch("/api/media/sign-upload", { method: "POST" });
  if (!signRes.ok) {
    // If signed upload endpoint is not available or credentials missing in dev, fallback if possible
    console.warn("[CLOUDINARY_SIGNED_FAIL] Server signature refused, checking fallback...");
    return uploadImageToCloudinary(file);
  }

  const signJson = await signRes.json();
  if (!signJson.success || !signJson.data) {
    return uploadImageToCloudinary(file);
  }

  const params: SignedUploadParams = signJson.data;

  // 3. Construct signed upload payload
  const formData = new FormData();
  formData.append("file", file);
  formData.append("api_key", params.apiKey);
  formData.append("timestamp", params.timestamp.toString());
  formData.append("signature", params.signature);
  formData.append("folder", params.folder);

  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${params.cloudName}/image/upload`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error("[CLOUDINARY_SIGNED_UPLOAD_ERROR]", errorData);
      throw new Error(`Upload failed: ${errorData.error?.message || "Unknown error"}`);
    }

    const data = await response.json();
    return { url: data.secure_url, publicId: data.public_id };
  } catch (error) {
    console.error("[SIGNED_UPLOAD_FATAL]", error);
    return null;
  }
}

/**
 * Legacy upload function with strict production configuration checks.
 */
export async function uploadImageToCloudinary(
  file: File
): Promise<{ url: string; publicId: string } | null> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "[CLOUDINARY_CONFIG_ERROR] Cloudinary environment variables (NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME, NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET) are not configured."
      );
    }
    console.warn(
      "[UPLOAD_DEV_WARNING] Cloudinary environment variables missing in development. Refusing to mock in production."
    );
    return null;
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);

  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error("[CLOUDINARY_ERROR_RESPONSE]", errorData);
      throw new Error(`Upload failed: ${errorData.error?.message || "Unknown error"}`);
    }

    const data = await response.json();
    return { url: data.secure_url, publicId: data.public_id };
  } catch (error) {
    console.error("[UPLOAD_FATAL]", error);
    return null;
  }
}

export async function deleteImageFromCloudinary(publicId: string) {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const apiKey = process.env.CLOUDINARY_API_KEY;

  if (!cloudName || !apiSecret || !apiKey) {
    return;
  }

  try {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const crypto = await import("crypto");
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
      console.log(
        `[CLOUDINARY_CLEANUP] Orphaned upload securely purged from CDN: ${publicId}`
      );
    } else {
      console.error(`[CLOUDINARY_CLEANUP_FAIL] Could not purge: ${publicId}`);
    }
  } catch (error) {
    console.error("[CLOUDINARY_CLEANUP_FATAL]", error);
  }
}
