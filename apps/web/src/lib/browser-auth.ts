"use client";

import { loadPublicEnv } from "@lexframe/config/src/public-env";
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";

const env = loadPublicEnv({
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_ACTIVEPIECES_INSTANCE_URL:
    process.env.NEXT_PUBLIC_ACTIVEPIECES_INSTANCE_URL,
  NEXT_PUBLIC_ACTIVEPIECES_RUNTIME_URL:
    process.env.NEXT_PUBLIC_ACTIVEPIECES_RUNTIME_URL,
  NEXT_PUBLIC_ACTIVEPIECES_MVP_CANVAS_ENABLED:
    process.env.NEXT_PUBLIC_ACTIVEPIECES_MVP_CANVAS_ENABLED,
  NEXT_PUBLIC_LEXFRAME_CANVAS_RESERVE_ENABLED:
    process.env.NEXT_PUBLIC_LEXFRAME_CANVAS_RESERVE_ENABLED,
  NEXT_PUBLIC_LEXFRAME_AP_DESIGN_SYSTEM_ENABLED:
    process.env.NEXT_PUBLIC_LEXFRAME_AP_DESIGN_SYSTEM_ENABLED,
  NEXT_PUBLIC_ACTIVEPIECES_EMBED_SDK_URL:
    process.env.NEXT_PUBLIC_ACTIVEPIECES_EMBED_SDK_URL,
  NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
  NEXT_PUBLIC_CONTRACTS_VERSION: process.env.NEXT_PUBLIC_CONTRACTS_VERSION,
});
const DEV_TOKEN_STORAGE_KEY = "lexframe.dev.access-token";
const SEEDED_DEV_USER_IDS: Record<string, string> = {
  "stage16.owner@lexframe.test": "16000000-0000-4000-8000-000000000001",
  "stage16.admin@lexframe.test": "16000000-0000-4000-8000-000000000002",
  "stage16.lawyer@lexframe.test": "16000000-0000-4000-8000-000000000003",
  "stage16.viewer@lexframe.test": "16000000-0000-4000-8000-000000000004",
  "stage16.security@lexframe.test": "16000000-0000-4000-8000-000000000005",
  "stage16.owner-b@lexframe.test": "16000000-0000-4000-8000-000000000006",
};

let browserClient: SupabaseClient | null = null;

export function getPublicEnv() {
  return env;
}

export function isDemoAuthMode() {
  return env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.startsWith("demo_");
}

export function getBrowserSupabaseClient(): SupabaseClient {
  if (!browserClient) {
    browserClient = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      },
    );
  }

  return browserClient;
}

export function readStoredDevAccessToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(DEV_TOKEN_STORAGE_KEY);
}

export function storeDevAccessToken(token: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(DEV_TOKEN_STORAGE_KEY, token);
}

export function clearStoredDevAccessToken() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(DEV_TOKEN_STORAGE_KEY);
}

export async function createDevAccessToken(input: {
  readonly email: string;
  readonly fullName?: string;
}) {
  const normalizedEmail = input.email.trim().toLowerCase();
  const userId =
    SEEDED_DEV_USER_IDS[normalizedEmail] ??
    (await hashEmailToUuid(normalizedEmail));
  const payload = {
    id: userId,
    email: normalizedEmail,
    fullName: input.fullName?.trim() || normalizedEmail.split("@")[0] || "LexFrame User",
    emailConfirmedAt: new Date().toISOString(),
    assuranceLevel: "aal1" as const,
  };

  const encoded = toBase64Url(JSON.stringify(payload));
  return `dev.${encoded}`;
}

export function getAccessTokenFromSession(session: Session | null) {
  return session?.access_token ?? null;
}

async function hashEmailToUuid(email: string) {
  const bytes = new TextEncoder().encode(email);
  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(hashBuffer))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function toBase64Url(value: string) {
  const base64 = btoa(unescape(encodeURIComponent(value)));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
