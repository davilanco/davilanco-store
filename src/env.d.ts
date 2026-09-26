/// <reference types="astro/client" />

type RuntimeEnv = {
  DB: D1Database;
  ASSETS: Fetcher;
  PUBLIC_SITE_URL: string;
  PUBLIC_STORE_NAME: string;
  ALLOWED_IMPORT_HOSTS?: string;
  SESSION_COOKIE_NAME?: string;
  SESSION_TTL_DAYS?: string;
  EMAIL_FROM?: string;
  RESEND_API_KEY?: string;
  PAYSTACK_SECRET_KEY?: string;
  FLUTTERWAVE_SECRET_KEY?: string;
  PAYPAL_CLIENT_ID?: string;
  PAYPAL_CLIENT_SECRET?: string;
  PAYPAL_ENVIRONMENT?: string;
  SMS_PROVIDER_URL?: string;
  SMS_PROVIDER_TOKEN?: string;
  ADMIN_BOOTSTRAP_SECRET?: string;
};

declare namespace App {
  interface Locals {
    runtime: { env: RuntimeEnv };
    user: import('./lib/auth').User | null;
  }
}
