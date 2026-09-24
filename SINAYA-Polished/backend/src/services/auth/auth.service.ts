import { z } from 'zod';
import { HttpError } from '../../utils/httpError';

export interface Authenticator { verify(token: string): Promise<string> }
export class SupabaseAuthenticator implements Authenticator {
  constructor(private readonly fetcher: typeof fetch = fetch) {}
  async verify(token: string): Promise<string> {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    if (!url || !key) throw new HttpError(503, 'AUTH_NOT_CONFIGURED', 'Supabase authentication is not configured.');
    try {
      const endpoint = new URL('/auth/v1/user', url);
      if (endpoint.protocol !== 'https:') throw new Error('HTTPS required');
      const response = await this.fetcher(endpoint, { headers: { apikey: key, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000), redirect: 'error' });
      if (response.status === 401 || response.status === 403) throw new HttpError(401, 'UNAUTHORIZED', 'Invalid or expired access token.');
      if (!response.ok) throw new Error('Auth unavailable');
      return z.object({ id: z.uuid() }).parse(await response.json()).id;
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(503, 'AUTH_UNAVAILABLE', 'Authentication service is unavailable.');
    }
  }
}
