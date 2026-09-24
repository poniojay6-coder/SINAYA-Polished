import type { RequestHandler } from "express";
import type { Database } from "../types/database";
import { farmerService } from "../services/farmer/farmer.service";
import * as v from "../validators/foundation";

export function farmerController(db: Database) {
  const service = farmerService(db);
  return {
    list: async (req, res) => {
      const query = v.farmerList.parse(req.query); res.json({ data: await service.list(query, res.locals.operator.id), pagination: query });
    },
    get: async (req, res) => {
      res.json({ data: await service.get(v.id.parse(req.params.id)) });
    },
    create: async (req, res) => {
      res.status(201).json({ data: await service.create(v.farmerCreate.parse(req.body), res.locals.userId) });
    },
    update: async (req, res) => {
      res.json({ data: await service.update(v.id.parse(req.params.id), v.farmerPatch.parse(req.body)) });
    },
  } satisfies Record<string, RequestHandler>;
}
