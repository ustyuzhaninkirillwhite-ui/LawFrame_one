export class SecretString {
  constructor(private readonly value: string) {}

  revealForProviderCall(): string {
    return this.value;
  }

  toJSON(): never {
    throw new Error('SECRET_SERIALIZATION_FORBIDDEN');
  }

  toString(): string {
    return '[REDACTED]';
  }

  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return '[REDACTED]';
  }
}
