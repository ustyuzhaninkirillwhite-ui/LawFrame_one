declare module 'node:crypto' {
  export function createHash(algorithm: string): {
    update(input: string): { digest(encoding: string): string };
    digest(encoding: string): string;
  };
}

declare module 'node:fs' {
  const value: any;
  export = value;
}

declare module 'node:path' {
  const value: any;
  export = value;
}
