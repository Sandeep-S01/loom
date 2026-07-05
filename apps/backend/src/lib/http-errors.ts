export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function badRequest(message: string) {
  return new HttpError(400, "BAD_REQUEST", message);
}

export function notFound(message: string) {
  return new HttpError(404, "NOT_FOUND", message);
}

export function conflict(message: string) {
  return new HttpError(409, "CONFLICT", message);
}
