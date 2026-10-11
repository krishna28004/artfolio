// Legacy module path retained for existing imports; commission references now use
// server-validated private Supabase Storage, not public Cloudinary delivery.
export type PrivateReferenceClaim = { id: string; token: string; name: string; size: number };

export async function uploadPrivateReference(file: File, onProgress?: (percent: number) => void): Promise<PrivateReferenceClaim> {
  if (file.size === 0 || file.size > 10 * 1024 * 1024) {
    throw new Error("File must be between 1 byte and 10 MB.");
  }
  const form = new FormData();
  form.append("file", file);
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/media/upload");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onerror = () => reject(new Error("Network error while uploading."));
    xhr.onabort = () => reject(new Error("Upload cancelled."));
    xhr.onload = () => {
      let result: { success?: boolean; message?: string; data?: PrivateReferenceClaim };
      try { result = JSON.parse(xhr.responseText); } catch { result = {}; }
      if (xhr.status < 200 || xhr.status >= 300 || !result.success || !result.data) {
        reject(new Error(result.message || "Private upload failed."));
      } else resolve(result.data);
    };
    xhr.send(form);
  });
}
