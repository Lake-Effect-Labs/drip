/**
 * Environment variable validation
 * Fails fast if critical vars are missing
 */

function getEnvVar(name: string, required = true): string {
  const value = process.env[name];
  if (required && !value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value || "";
}

export const env = {
  // Supabase
  supabaseUrl: getEnvVar("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: getEnvVar("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  supabaseServiceRoleKey: getEnvVar("SUPABASE_SERVICE_ROLE_KEY"),

  // Stripe (for customer payments)
  stripeSecretKey: getEnvVar("STRIPE_SECRET_KEY", false),
  stripePublishableKey: getEnvVar("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", false),
  stripeWebhookSecret: getEnvVar("STRIPE_WEBHOOK_SECRET", false),

  // Weather API
  weatherApiKey: getEnvVar("WEATHER_API_KEY", false),

  // App
  appUrl: getEnvVar("NEXT_PUBLIC_APP_URL", false) || "http://localhost:3000",

  // Node env
  isDevelopment: process.env.NODE_ENV === "development",
  isProduction: process.env.NODE_ENV === "production",
};

// Validate on import (fails fast)
if (env.isProduction) {
  if (!env.supabaseUrl || !env.supabaseAnonKey || !env.supabaseServiceRoleKey) {
    throw new Error("Missing required Supabase environment variables");
  }
  // Stripe, Weather API, and OpenAI are optional
  // They should be configured in production if those features are needed
}
