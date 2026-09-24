import { z } from "zod";
import { page } from "./foundation";

export const sensorCreate = z.object({ serialNumber: z.string().trim().min(1).max(100) }).strict();
export const readingCreate = z.object({
  observedAt: z.iso.datetime({ offset: true }).transform((v) => new Date(v)),
  source: z.enum(["device", "simulated"]),
  dissolvedOxygenMgL: z.number().finite().min(0).max(100),
  ph: z.number().finite().min(0).max(14),
  waterTemperatureC: z.number().finite().min(-5).max(60),
}).strict();
export const readingList = page.extend({ source: z.enum(["device", "simulated"]).default("device") }).strict();
export const latestQuery = z.object({ source: z.enum(["device", "simulated"]).default("device") }).strict();
export type ReadingInput = z.output<typeof readingCreate>;
