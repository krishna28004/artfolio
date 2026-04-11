export async function uploadImageToCloudinary(
  file: File
): Promise<{ url: string; publicId: string } | null> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    console.error("[UPLOAD_WARN] Cloudinary env variables missing. Mocking upload.");
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return {
      url: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
      publicId: `mock_${Date.now()}`,
    };
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
    console.log(
      `[CLOUDINARY_CLEANUP_MOCK] Orphaned upload securely purged from CDN (mock due to missing keys): ${publicId}`
    );
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
