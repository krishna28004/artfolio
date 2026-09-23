function validateEnv(key: string, defaultValue?: string): string {
  const value = process.env[key] || defaultValue;

  if (!value && process.env.NODE_ENV === "production") {
    console.error(`[CONFIG_WARN] Missing environment variable: ${key}`);
  }

  return value || "";
}

export const CONFIG = {
  siteUrl: validateEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000"),
  supabase: {
    url: validateEnv("NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: validateEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    serviceRoleKey: validateEnv("SUPABASE_SERVICE_ROLE_KEY"),
  },
  razorpay: {
    keyId: validateEnv("RAZORPAY_KEY_ID") || validateEnv("NEXT_PUBLIC_RAZORPAY_KEY_ID"),
    secret: validateEnv("RAZORPAY_SECRET"),
    webhookSecret: validateEnv("RAZORPAY_WEBHOOK_SECRET"),
  },
  cloudinary: {
    cloudName: validateEnv("NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME"),
    uploadPreset: validateEnv("NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET"),
  },
  email: {
    resendApiKey: validateEnv("RESEND_API_KEY"),
    fromEmail: validateEnv("RESEND_FROM_EMAIL", "curator@artfolio.com"),
    adminEmail: validateEnv("ADMIN_NOTIFICATION_EMAIL", "admin@artfolio.com"),
  },
  admin: {
    apiKey: validateEnv("ADMIN_API_KEY"),
  },
  isDevelopment: process.env.NODE_ENV === "development",
  isProduction: process.env.NODE_ENV === "production",
};
