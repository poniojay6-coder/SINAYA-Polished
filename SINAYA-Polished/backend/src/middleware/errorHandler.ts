import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { HttpError } from "../utils/httpError";

export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid request.",
      issues: error.issues.map(({ path, message }) => ({ path: path.join("."), message })) } });
    return;
  }
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: { code: error.code, message: error.message } });
    return;
  }
  const failure = error as { code?: string; type?: string; cause?: { code?: string } } | null;
  const code = failure?.code ?? failure?.cause?.code;
  if (failure?.type === "entity.parse.failed") {
    res.status(400).json({ error: { code: "INVALID_JSON", message: "Request body must be valid JSON." } });
  } else if (failure?.type === "entity.too.large") {
    res.status(413).json({ error: { code: "BODY_TOO_LARGE", message: "Request body exceeds 32 KB." } });
  } else if (code === "23505") {
    res.status(409).json({ error: { code: "CONFLICT", message: "This record already exists." } });
  } else if (["23503", "23001"].includes(code ?? "")) {
    res.status(409).json({ error: { code: "REFERENCE_CONFLICT", message: "A related record is missing or prevents this change." } });
  } else if (["23514", "23502", "22003", "22007", "22008"].includes(code ?? "")) {
    res.status(422).json({ error: { code: "INVALID_STATE", message: "The change violates a data constraint." } });
  } else if (["ENOTFOUND", "ECONNREFUSED", "ETIMEDOUT", "CONNECT_TIMEOUT", "CONNECTION_CLOSED", "28P01", "42P01", "42501", "57P01", "53300"].includes(code ?? "") || code?.startsWith("08")) {
    res.status(503).json({ error: { code: "DATABASE_UNAVAILABLE", message: "Database unavailable or not ready. Check its connection, migrations, and role permissions." } });
  } else {
    // Never expose SQL, connection strings, raw request bodies, or driver errors.
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } });
  }
};
