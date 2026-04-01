/**
 * Cloudflare Pages Middleware
 *
 * Runs at the edge BEFORE any request reaches the origin.
 * Geo-blocking is currently disabled here; requests pass through unchanged.
 */

export async function onRequest(context: {
  request: Request;
  next: () => Promise<Response>;
  env: Record<string, string>;
}): Promise<Response> {
  const { next } = context;
  return next();
}
