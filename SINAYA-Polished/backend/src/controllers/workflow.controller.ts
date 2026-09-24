import type { RequestHandler } from 'express';
import { z } from 'zod';
import type { Database } from '../types/database';
import type { WeatherProvider } from '../services/weather/openMeteo.provider';
import { workflowService } from '../services/advisory/workflow.service';
import { id, page } from '../validators/foundation';

export function workflowController(db: Database, provider: WeatherProvider) {
  const service = workflowService(db, provider);
  const evaluate = z.object({ cycleId: id, source: z.enum(['device','simulated']).default('device'), availableEquipmentIds: z.array(id).max(100).default([]) }).strict();
  return {
    evaluate: async (req, res) => { const body = evaluate.parse(req.body); res.status(201).json({ data: await service.evaluate(id.parse(req.params.pondId), body.cycleId, body.source, body.availableEquipmentIds) }); },
    list: async (req, res) => { const p = page.strict().parse(req.query); res.json({ data: await service.list(id.parse(req.params.pondId), p), pagination: p }); },
    get: async (req, res) => { res.json({ data: await service.get(id.parse(req.params.pondId), id.parse(req.params.assessmentId)) }); },
    createAdvisory: async (req, res) => { const body = z.object({ languageCode: z.string().trim().min(1).max(50) }).strict().parse(req.body); res.status(201).json({ data: await service.createAdvisory(id.parse(req.params.pondId), id.parse(req.params.assessmentId), body.languageCode) }); },
    advisories: async (req, res) => { res.json({ data: await service.advisories(id.parse(req.params.pondId), id.parse(req.params.assessmentId)) }); },
    draft: async (req, res) => { z.object({}).strict().parse(req.body); res.json({ data: await service.draft(id.parse(req.params.pondId), id.parse(req.params.assessmentId), id.parse(req.params.advisoryId)) }); },
    simulate: async (req, res) => { z.object({}).strict().parse(req.body); res.json({ data: await service.simulate(id.parse(req.params.pondId), id.parse(req.params.assessmentId), id.parse(req.params.advisoryId)) }); },
  } satisfies Record<string, RequestHandler>;
}
