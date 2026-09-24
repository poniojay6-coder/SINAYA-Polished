import type { RequestHandler } from "express";
import type { Database } from "../types/database";
import { pondService } from "../services/pond/pond.service";
import * as v from "../validators/foundation";

export function pondController(db: Database) {
  const service = pondService(db);
  return {
    list: async (req, res) => {
      const query = v.pondList.parse(req.query); res.json({ data: await service.list(query, res.locals.operator.id), pagination: query });
    },
    get: async (req, res) => {
      res.json({ data: await service.get(v.id.parse(req.params.id)) });
    },
    create: async (req, res) => {
      res.status(201).json({ data: await service.create(v.pondCreate.parse(req.body)) });
    },
    update: async (req, res) => {
      res.json({ data: await service.update(v.id.parse(req.params.id), v.pondPatch.parse(req.body)) });
    },
  } satisfies Record<string, RequestHandler>;
}
