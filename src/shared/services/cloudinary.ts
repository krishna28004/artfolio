/**
 * Client-side Cloudinary service with strict server-validated upload capability.
 * Contains ZERO server secrets.
 */

/**
 * Uploads an image via the secure server-validated media endpoint.
 * Guarantees that folder, size (10MB max), MIME type, and magic bytes are strictly enforced by the server.
 */
export async function uploadImageToCloudinarySigned(
  file: File
): Promise<{ url: string; publicId: string } | null> {
  // 1. Client-side preliminary guard
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("File exceeds maximum allowable upload size of 10MB.");
  }

  // 2. Submit to server-side validated upload route
  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await fetch("/api/media/upload", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const errorJson = await res.json().catch(() => ({}));
      throw new Error(errorJson.message || `Upload failed with status ${res.status}`);
    }

    const json = await res.json();
    if (!json.success || !json.data) {
      throw new Error(json.message || "Failed to receive valid upload metadata from server.");
    }

    return {
      url: json.data.url,
      publicId: json.data.publicId,
    };
  } catch (error) {
    console.error("[UPLOAD_SERVICE_ERROR]", error);
    throw error;
  }
}
