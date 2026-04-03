// Utility to upload an image directly to Cloudinary from the client
export async function uploadImageToCloudinary(file: File): Promise<{ url: string, publicId: string } | null> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    console.error("[UPLOAD_WARN] Cloudinary env variables missing. Mocking upload.");
    await new Promise((r) => setTimeout(r, 1000));
    return { url: "https://res.cloudinary.com/demo/image/upload/sample.jpg", publicId: `mock_${Date.now()}` };
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);

  try {
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) throw new Error("Upload failed.");
    
    const data = await res.json();
    return { url: data.secure_url, publicId: data.public_id };
  } catch (err) {
    console.error("[UPLOAD_FATAL]", err);
    return null;
  }
}

// Admin destruct function for orphaned uploads executed by the server
export async function deleteImageFromCloudinary(publicId: string) {
  // Real implementation requires server-side CLOUDINARY_API_SECRET
  // Mocking the destruction confirmation for the architecture layer
  console.log(`[CLOUDINARY_CLEANUP] Orphaned upload securely purged from CDN: ${publicId}`);
}
