declare module 'node:child_process' {
  export function spawnSync(
    command: string,
    args?: readonly string[],
    options?: Record<string, unknown>,
  ): { readonly status: number | null };
}
