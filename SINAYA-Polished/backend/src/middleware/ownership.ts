import type { RequestHandler } from 'express';
import { eq } from 'drizzle-orm';
import { farms, ponds, sensorUnits, stockingCycles } from '../db/schema';
import type { Database } from '../types/database';
import { id } from '../validators/foundation';
import { HttpError } from '../utils/httpError';

export function ownership(db: Database): RequestHandler {
  return async (req, res, next) => {
    const actor = res.locals.operator?.id;
    const denied = () => { throw new HttpError(404, 'NOT_FOUND', 'Resource not found.'); };
    const ownOperator = (value: unknown) => { if (id.parse(value) !== actor) denied(); };
    const ownFarm = async (value: unknown) => {
      const row = (await db.select().from(farms).where(eq(farms.id, id.parse(value))))[0];
      if (!row || row.operatorId !== actor) denied();
    };
    const ownPond = async (value: unknown) => {
      const row = (await db.select().from(ponds).where(eq(ponds.id, id.parse(value))))[0];
      if (!row) return denied();
      await ownFarm(row.farmId);
    };
    const parts = req.path.split('/').filter(Boolean).map(decodeURIComponent);
    parts[0] = parts[0]?.toLowerCase();
    if (parts[0] === 'farmers' && parts[1]) ownOperator(parts[1]);
    if (parts[0] === 'farms' && parts[1]) await ownFarm(parts[1]);
    if (parts[0] === 'ponds' && parts[1]) await ownPond(parts[1]);
    if (parts[0] === 'sensors' && parts[1]) {
      const unit = (await db.select().from(sensorUnits).where(eq(sensorUnits.id, id.parse(parts[1]))))[0];
      if (!unit) return denied();
      await ownPond(unit.pondId);
    }
    if (parts[0] === 'stocking-cycles' && parts[1]) {
      const cycle = (await db.select().from(stockingCycles).where(eq(stockingCycles.id, id.parse(parts[1]))))[0];
      if (!cycle) return denied();
      await ownPond(cycle.pondId);
    }
    if (parts[0] === 'farms' && !parts[1]) {
      if (req.method === 'POST' && req.body?.operatorId !== undefined) ownOperator(req.body.operatorId);
      if (req.query.operatorId !== undefined) ownOperator(req.query.operatorId);
    }
    if (parts[0] === 'ponds' && !parts[1]) {
      if (req.method === 'POST' && req.body?.farmId !== undefined) await ownFarm(req.body.farmId);
      if (req.query.farmId !== undefined) await ownFarm(req.query.farmId);
    }
    if (parts[0] === 'stocking-cycles' && !parts[1]) {
      if (req.method === 'POST' && req.body?.pondId !== undefined) await ownPond(req.body.pondId);
      if (req.query.pondId !== undefined) await ownPond(req.query.pondId);
    }
    next();
  };
}
