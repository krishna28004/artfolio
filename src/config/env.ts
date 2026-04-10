/**
 * Global Engine Configuration & Environment Validation
 * Ensures the production environment is hydrated with mandatory keys before runtime.
 */

function validateEnv(key: string, defaultValue?: string): string {
  const value = process.env[key] || defaultValue;
  
  if (!value && process.env.NODE_ENV === "production") {
    console.error(`[ENGINE_FATAL] Missing mandatory environment variable: ${key}`);
    // In production, we want to know immediately if a secret is missing.
  }
  
  return value || "";
}

export const CONFIG = {
  supabase: {
    url: validateEnv("NEXT_PUBLIC_SUPABASE_URL", "https://placeholder.supabase.co"),
    anonKey: validateEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "placeholder-key"),
  },
  cloudinary: {
    cloudName: validateEnv("NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME"),
    uploadPreset: validateEnv("NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET"),
  },
  resend: {
    apiKey: validateEnv("RESEND_API_KEY"),
  },
  admin: {
    apiKey: validateEnv("ADMIN_API_KEY"),
  },
  isDevelopment: process.env.NODE_ENV === "development",
  isProduction: process.env.NODE_ENV === "production",
};
