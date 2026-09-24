import type { RequestHandler } from 'express';
import type { Database } from '../types/database';
import type { WeatherProvider } from '../services/weather/openMeteo.provider';
import { weatherService } from '../services/weather/weather.service';
import { id } from '../validators/foundation';
import { z } from 'zod';

export function weatherController(db: Database, provider: WeatherProvider): RequestHandler {
  const service = weatherService(db, provider);
  return async (req, res) => {
    z.object({}).strict().parse(req.query);
    res.json({ data: await service.forPond(id.parse(req.params.pondId)) });
  };
}
