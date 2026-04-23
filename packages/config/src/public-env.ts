import { z } from "zod";

export const publicEnvSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z.string().url().default("http://localhost:3100"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().default("http://127.0.0.1:54321"),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(10).default("demo_publishable_key"),
  NEXT_PUBLIC_ACTIVEPIECES_INSTANCE_URL: z.string().url().default("http://127.0.0.1:8080"),
  NEXT_PUBLIC_ACTIVEPIECES_EMBED_SDK_URL: z.string().url().default("https://cdn.activepieces.com/sdk/embed/0.8.1.js"),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().min(3).default("phc_stage_local"),
  NEXT_PUBLIC_CONTRACTS_VERSION: z.string().min(1).default("stage11"),
  NEXT_PUBLIC_ENABLE_MSW: z.enum(["0", "1"]).default("0"),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

export function loadPublicEnv(source: Record<string, string | undefined> = process.env): PublicEnv {
  return publicEnvSchema.parse(source);
}
