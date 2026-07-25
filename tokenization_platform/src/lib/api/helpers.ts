import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getToken } from "@/lib/db/repo";
import type { TokenRecord } from "@/types";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function requireToken(tokenId: string): TokenRecord {
  const token = getToken(tokenId);
  if (!token) throw new ApiError(`Token ${tokenId} not found`, 404);
  return token;
}

/** Wraps a route handler body so thrown ApiErrors (and Hedera SDK errors) become JSON responses. */
export async function handleRoute(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof ZodError) {
      const message = err.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
      return NextResponse.json({ error: message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new ApiError("Request body must be valid JSON", 400);
  }
}
