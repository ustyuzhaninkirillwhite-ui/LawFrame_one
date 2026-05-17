import { z } from "zod";

const publicAssetUrlSchema = z.string().min(1).refine(
  (value) => {
    if (value.startsWith("/")) {
      return true;
    }

    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  },
  { message: "Expected an absolute URL or root-relative public asset path." },
);

export const publicEnvSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z.string().url().default("http://127.0.0.1:3100"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().default("http://127.0.0.1:54321"),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(10).default("demo_publishable_key"),
  NEXT_PUBLIC_ACTIVEPIECES_INSTANCE_URL: z.string().url().default("http://127.0.0.1:8080"),
  NEXT_PUBLIC_ACTIVEPIECES_RUNTIME_URL: z
    .string()
    .url()
    .default("http://127.0.0.1:3100/automation-runtime"),
  NEXT_PUBLIC_ACTIVEPIECES_MVP_CANVAS_ENABLED: z.enum(["0", "1"]).default("1"),
  NEXT_PUBLIC_LEXFRAME_CANVAS_RESERVE_ENABLED: z.enum(["0", "1"]).default("0"),
  NEXT_PUBLIC_LEXFRAME_AP_DESIGN_SYSTEM_ENABLED: z.enum(["0", "1"]).default("0"),
  NEXT_PUBLIC_ACTIVEPIECES_EMBED_SDK_URL: publicAssetUrlSchema.default("/vendor/activepieces/embed-sdk-0.9.0.js"),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().min(3).default("phc_stage_local"),
  NEXT_PUBLIC_CONTRACTS_VERSION: z.string().min(1).default("stage11"),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

export function loadPublicEnv(source: Record<string, string | undefined> = process.env): PublicEnv {
  return publicEnvSchema.parse(source);
}
