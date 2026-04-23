"use client";

import { loadPublicEnv } from "@lexframe/config/src/public-env";
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";

const env = loadPublicEnv();
const DEV_TOKEN_STORAGE_KEY = "lexframe.dev.access-token";

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
  const userId = await hashEmailToUuid(normalizedEmail);
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
