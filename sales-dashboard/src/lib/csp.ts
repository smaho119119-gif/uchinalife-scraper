import { headers } from 'next/headers';

/**
 * Read the per-request CSP nonce that middleware injected via the
 * `x-nonce` request header.
 *
 * Use in Server Components when emitting third-party scripts:
 *
 *   const nonce = await getCspNonce();
 *   <Script nonce={nonce} src="https://example.com/sdk.js" />
 *
 * Returns `undefined` when no nonce is present (e.g. when running outside
 * the request lifecycle), so the caller can decide whether that's a bug.
 */
export async function getCspNonce(): Promise<string | undefined> {
    const h = await headers();
    return h.get('x-nonce') ?? undefined;
}
