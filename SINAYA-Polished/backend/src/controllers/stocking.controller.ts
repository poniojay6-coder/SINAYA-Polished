import type { RequestHandler } from "express";
import type { Database } from "../types/database";
import { stockingService } from "../services/stocking/stocking.service";
import * as v from "../validators/foundation";

export function stockingController(db: Database) {
  const service = stockingService(db);
  return {
    list: async (req, res) => {
      const query = v.cycleList.parse(req.query); res.json({ data: await service.list(query, res.locals.operator.id), pagination: query });
    },
    get: async (req, res) => {
      res.json({ data: await service.get(v.id.parse(req.params.id)) });
    },
    create: async (req, res) => {
      res.status(201).json({ data: await service.create(v.cycleCreate.parse(req.body)) });
    },
    update: async (req, res) => {
      res.json({ data: await service.update(v.id.parse(req.params.id), v.cyclePatch.parse(req.body)) });
    },
  } satisfies Record<string, RequestHandler>;
}
