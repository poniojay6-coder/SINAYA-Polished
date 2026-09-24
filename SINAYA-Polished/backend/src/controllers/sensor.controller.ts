import type { RequestHandler } from "express";
import type { Database } from "../types/database";
import { sensorService } from "../services/sensor/sensor.service";
import { id, page } from "../validators/foundation";
import { latestQuery, readingCreate, readingList, sensorCreate } from "../validators/sensor";

export function sensorController(db: Database) {
  const service = sensorService(db);
  return {
    register: async (req, res) => { res.status(201).json({ data: await service.register(id.parse(req.params.pondId), sensorCreate.parse(req.body).serialNumber) }); },
    list: async (req, res) => { const p = page.strict().parse(req.query); res.json({ data: await service.list(id.parse(req.params.pondId), p), pagination: p }); },
    retire: async (req, res) => { res.json({ data: await service.retire(id.parse(req.params.pondId), id.parse(req.params.id)) }); },
    ingest: async (req, res) => { const result = await service.ingest(id.parse(req.params.id), readingCreate.parse(req.body)); res.status(result.duplicate ? 200 : 201).json({ data: result.reading, duplicate: result.duplicate }); },
    history: async (req, res) => { const p = readingList.parse(req.query); res.json({ data: await service.history(id.parse(req.params.pondId), p), pagination: p }); },
    latest: async (req, res) => { res.json({ data: await service.latest(id.parse(req.params.pondId), latestQuery.parse(req.query).source) }); },
  } satisfies Record<string, RequestHandler>;
}
