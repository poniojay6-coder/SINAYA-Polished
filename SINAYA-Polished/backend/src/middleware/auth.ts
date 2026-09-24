import type { RequestHandler } from 'express';
import { eq } from 'drizzle-orm';
import { farmers } from '../db/schema';
import type { Database } from '../types/database';
import type { Authenticator } from '../services/auth/auth.service';
import { HttpError } from '../utils/httpError';

export function authenticate(db: Database, provider: Authenticator): RequestHandler {
  return async (req, res, next) => {
    const path = req.path.replace(/\/+$/, '').toLowerCase();
    const match = /^Bearer (\S+)$/i.exec(req.headers.authorization ?? '');
    if (!match) throw new HttpError(401, 'UNAUTHORIZED', 'A Bearer access token is required.');
    res.locals.userId = await provider.verify(match[1]);
    res.locals.operator = (await db.select().from(farmers).where(eq(farmers.authUserId, res.locals.userId)))[0] ?? null;
    if (path === '/auth/me' && req.method === 'GET') { res.json({ data: { userId: res.locals.userId, operator: res.locals.operator } }); return; }
    if (['/languages', '/species', '/equipment'].includes(path) && req.method === 'GET') { next(); return; }
    if (path === '/farmers' && req.method === 'POST') {
      if (res.locals.operator) throw new HttpError(409, 'PROFILE_EXISTS', 'This account already has an operator profile.');
      next(); return;
    }
    if (!res.locals.operator) throw new HttpError(403, 'PROFILE_REQUIRED', 'Create your operator profile first.');
    if (res.locals.operator.accountStatus !== 'active') throw new HttpError(403, 'ACCOUNT_INACTIVE', 'This operator account is inactive.');
    next();
  };
}
