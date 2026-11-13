import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { errorResponse } from '@/lib/api-auth';

/**
 * Parses and validates a JSON request body. Returns the data, or a 400
 * response to return as-is:
 *
 *   const body = await parseBody(req, Schema);
 *   if (body instanceof NextResponse) return body;
 */
/** Zod's built-in messages ("Too small: expected string to have >=2 characters") are for developers */
const BUILT_IN = /^(Too small|Too big|Invalid|Expected|Unrecognized|Required)/i;

/** "destinationName" -> "destination name" */
function fieldLabel(path: PropertyKey[]): string {
  const last = [...path].reverse().find((p) => typeof p === 'string') as string | undefined;
  return last ? last.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase() : 'the form';
}

/** The first problem with a request, in words a resident understands */
export function friendlyIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return 'Invalid request';
  if (!BUILT_IN.test(issue.message)) return issue.message;
  const field = fieldLabel(issue.path);
  if (issue.code === 'too_small') return `Please fill in the ${field}`;
  if (issue.code === 'too_big') return `The ${field} is too long or too large`;
  return `Please check the ${field}`;
}

export async function parseBody<T extends z.ZodType>(
  req: NextRequest,
  schema: T
): Promise<z.infer<T> | NextResponse> {
  const raw = await req.json().catch(() => undefined);
  const result = schema.safeParse(raw ?? {});
  if (!result.success) {
    return errorResponse(friendlyIssue(result.error));
  }
  return result.data;
}

/** Same as parseBody for URL query parameters */
export function parseQuery<T extends z.ZodType>(
  req: NextRequest,
  schema: T
): z.infer<T> | NextResponse {
  const raw = Object.fromEntries(req.nextUrl.searchParams.entries());
  const result = schema.safeParse(raw);
  if (!result.success) {
    return errorResponse(friendlyIssue(result.error));
  }
  return result.data;
}
