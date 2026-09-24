import { and, desc, eq } from "drizzle-orm";
import { ponds, sensorReadings, sensorUnits } from "../../db/schema";
import type { Database } from "../../types/database";
import type { Page } from "../../validators/foundation";
import type { ReadingInput } from "../../validators/sensor";
import { HttpError, required } from "../../utils/httpError";
import { active, requirePond } from "../foundationChecks";

export const STALE_AFTER_SECONDS = 15 * 60;
export function sensorService(db: Database, now = () => new Date()) {
  const pondExists = async (pondId: string) => required((await db.select({ id: ponds.id }).from(ponds).where(eq(ponds.id, pondId)))[0], "Pond");
  return {
    async register(pondId: string, serialNumber: string) {
      await requirePond(db, pondId);
      return (await db.insert(sensorUnits).values({ pondId, serialNumber }).returning())[0]!;
    },
    async list(pondId: string, p: Page) {
      await pondExists(pondId);
      return db.select().from(sensorUnits).where(eq(sensorUnits.pondId, pondId)).orderBy(sensorUnits.id).limit(p.limit).offset(p.offset);
    },
    retire: (pondId: string, id: string) => db.transaction(async (tx) => {
      const scope = and(eq(sensorUnits.id, id), eq(sensorUnits.pondId, pondId));
      required((await tx.select().from(sensorUnits).where(scope).for("update"))[0], "Sensor unit");
      return (await tx.update(sensorUnits).set({ isActive: false }).where(scope).returning())[0]!;
    }),
    ingest: (sensorId: string, input: ReadingInput) => db.transaction(async (tx) => {
      const unit = required((await tx.select().from(sensorUnits).where(eq(sensorUnits.id, sensorId)).for("update"))[0], "Sensor unit");
      active(unit.isActive, "Sensor unit");
      await requirePond(tx, unit.pondId);
      if (input.observedAt.getTime() > now().getTime()) throw new HttpError(422, "FUTURE_READING", "Observed time cannot be in the future.");
      const inserted = await tx.insert(sensorReadings).values({ ...input, sensorId }).onConflictDoNothing().returning();
      if (inserted[0]) return { reading: inserted[0], duplicate: false };
      const previous = required((await tx.select().from(sensorReadings).where(and(eq(sensorReadings.sensorId, sensorId), eq(sensorReadings.observedAt, input.observedAt), eq(sensorReadings.source, input.source))))[0], "Reading");
      if (previous.ph !== input.ph || previous.dissolvedOxygenMgL !== input.dissolvedOxygenMgL || previous.waterTemperatureC !== input.waterTemperatureC) {
        throw new HttpError(409, "READING_CONFLICT", "A different reading already exists for this sensor, timestamp, and source.");
      }
      return { reading: previous, duplicate: true };
    }),
    async history(pondId: string, p: Page & { source: "device" | "simulated" }) {
      await pondExists(pondId);
      return db.select({ reading: sensorReadings, sensorId: sensorUnits.id, pondId: sensorUnits.pondId }).from(sensorReadings)
        .innerJoin(sensorUnits, eq(sensorUnits.id, sensorReadings.sensorId))
        .where(and(eq(sensorUnits.pondId, pondId), eq(sensorReadings.source, p.source)))
        .orderBy(desc(sensorReadings.observedAt), sensorReadings.id).limit(p.limit).offset(p.offset);
    },
    async latest(pondId: string, source: "device" | "simulated") {
      await pondExists(pondId);
      const checkedAt = now();
      const unit = (await db.select().from(sensorUnits).where(and(eq(sensorUnits.pondId, pondId), eq(sensorUnits.isActive, true))))[0];
      const reading = unit ? (await db.select().from(sensorReadings).where(and(eq(sensorReadings.sensorId, unit.id), eq(sensorReadings.source, source))).orderBy(desc(sensorReadings.observedAt)).limit(1))[0] : undefined;
      const ageSeconds = reading ? Math.max(0, Math.floor((checkedAt.getTime() - reading.observedAt.getTime()) / 1000)) : null;
      return { pondId, source, sensorId: unit?.id ?? null, reading: reading ?? null, checkedAt,
        status: !unit ? "no_sensor" : !reading ? "missing" : ageSeconds! >= STALE_AFTER_SECONDS ? "stale" : "fresh",
        ageSeconds, staleAfterSeconds: STALE_AFTER_SECONDS };
    },
  };
}
