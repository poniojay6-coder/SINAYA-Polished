export class HttpError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
  }
}

export function required<T>(value: T | undefined, label: string): T {
  if (!value) throw new HttpError(404, "NOT_FOUND", `${label} not found.`);
  return value;
}
