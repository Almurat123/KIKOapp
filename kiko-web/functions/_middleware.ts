/**
 * Cloudflare Pages Middleware — Geo-blocking
 *
 * Runs at the edge BEFORE any request reaches the origin.
 * `request.cf.country` is provided free by Cloudflare on all plans.
 * No IP address is stored or forwarded.
 */

const BLOCKED_COUNTRIES = [
  'CN', // Mainland China — legally prohibited, regulatory requirement
];

export async function onRequest(context: {
  request: Request;
  next: () => Promise<Response>;
  env: Record<string, string>;
}): Promise<Response> {
  const { request, next } = context;

  const country = (request as any).cf?.country as string | undefined;

  if (country && BLOCKED_COUNTRIES.includes(country)) {
    return new Response(
      JSON.stringify({
        error: 'Service not available in your region.',
        code: 'GEO_BLOCKED',
      }),
      {
        status: 451, // 451 = Unavailable For Legal Reasons (RFC 7725)
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      }
    );
  }

  return next();
}
