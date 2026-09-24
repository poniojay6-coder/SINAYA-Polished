import type { RequestHandler } from "express";
import type { Database } from "../types/database";
import { equipmentService } from "../services/equipment/equipment.service";
import * as v from "../validators/foundation";

export function equipmentController(db: Database) {
  const service = equipmentService(db);
  return {
    list: async (req, res) => {
      const query = v.page.strict().parse(req.query); res.json({ data: await service.list(v.id.parse(req.params.farmerId), query), pagination: query });
    },
    create: async (req, res) => {
      res.status(201).json({ data: await service.create(v.id.parse(req.params.farmerId), v.equipmentCreate.parse(req.body)) });
    },
    update: async (req, res) => {
      res.json({ data: await service.update(v.id.parse(req.params.farmerId), v.id.parse(req.params.id), v.equipmentPatch.parse(req.body).quantity) });
    },
  } satisfies Record<string, RequestHandler>;
}

