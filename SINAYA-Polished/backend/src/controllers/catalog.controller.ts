import type { RequestHandler } from "express";
import type { Database } from "../types/database";
import { catalogService } from "../services/catalog/catalog.service";
import * as v from "../validators/foundation";

export function catalogController(db: Database) {
  const service = catalogService(db);
  return {
    languages: async (req, res) => {
      const query = v.catalogueList.parse(req.query); res.json({ data: await service.languages(query), pagination: query });
    },
    species: async (req, res) => {
      const query = v.page.strict().parse(req.query); res.json({ data: await service.species(query), pagination: query });
    },
    equipment: async (req, res) => {
      const query = v.page.strict().parse(req.query); res.json({ data: await service.equipment(query), pagination: query });
    },
  } satisfies Record<string, RequestHandler>;
}

