import type { RequestHandler } from "express";
import type { Database } from "../types/database";
import { farmService } from "../services/farm/farm.service";
import * as v from "../validators/foundation";

export function farmController(db: Database) {
  const service = farmService(db);
  return {
    list: async (req, res) => {
      const query = v.farmList.parse(req.query); res.json({ data: await service.list(query, res.locals.operator.id), pagination: query });
    },
    get: async (req, res) => {
      res.json({ data: await service.get(v.id.parse(req.params.id)) });
    },
    create: async (req, res) => {
      res.status(201).json({ data: await service.create(v.farmCreate.parse(req.body)) });
    },
    update: async (req, res) => {
      res.json({ data: await service.update(v.id.parse(req.params.id), v.farmPatch.parse(req.body)) });
    },
    contacts: async (req, res) => {
      const query = v.page.strict().parse(req.query); res.json({ data: await service.contacts(v.id.parse(req.params.farmId), query), pagination: query });
    },
    createContact: async (req, res) => {
      res.status(201).json({ data: await service.createContact(v.id.parse(req.params.farmId), v.contactCreate.parse(req.body)) });
    },
    updateContact: async (req, res) => {
      res.json({ data: await service.updateContact(v.id.parse(req.params.farmId), v.id.parse(req.params.id), v.contactPatch.parse(req.body)) });
    },
  } satisfies Record<string, RequestHandler>;
}
