import { and, eq, inArray } from "drizzle-orm";
import { farms, ponds, species, stockingCycles } from "../../db/schema";
import type { Database } from "../../types/database";
import type { CycleCreate, CyclePatch, Page } from "../../validators/foundation";
import { HttpError, required } from "../../utils/httpError";
import { active, requirePond } from "../foundationChecks";

function checkDates(stocked: string, expected?: string | null, actual?: string | null) {
  if ((expected && expected < stocked) || (actual && actual < stocked)) {
    throw new HttpError(422, "INVALID_HARVEST_DATE", "Harvest dates cannot precede the stocking date.");
  }
}

export function stockingService(db: Database) {
  return {
    get: async (id: string) => required((await db.select().from(stockingCycles).where(eq(stockingCycles.id, id)))[0], "Stocking cycle"),
    list: (p: Page & { pondId?: string }, actor: string) => db.select().from(stockingCycles).where(and(inArray(stockingCycles.pondId, db.select({ id: ponds.id }).from(ponds).innerJoin(farms, eq(farms.id, ponds.farmId)).where(eq(farms.operatorId, actor))), p.pondId ? eq(stockingCycles.pondId, p.pondId) : undefined)).orderBy(stockingCycles.id).limit(p.limit).offset(p.offset),
    create: (input: CycleCreate) => db.transaction(async (tx) => {
      // Lock the pond while taking its self-reported area snapshot.
      const pond = required((await tx.select().from(ponds).where(eq(ponds.id, input.pondId)).for("update"))[0], "Pond");
      await requirePond(tx, input.pondId);
      const fish = required((await tx.select().from(species).where(eq(species.id, input.speciesId)))[0], "Species");
      active(fish.isActive, "Species");
      checkDates(input.stockingDate, input.expectedHarvestDate);
      return (await tx.insert(stockingCycles).values({ ...input, stockedAreaM2: pond.areaM2 }).returning())[0]!;
    }),
    update: (id: string, input: CyclePatch) => db.transaction(async (tx) => {
      const previous = required((await tx.select().from(stockingCycles).where(eq(stockingCycles.id, id)).for("update"))[0], "Stocking cycle");
      if (previous.status !== "active") throw new HttpError(409, "CYCLE_CLOSED", "Closed cycles are historical records and cannot be edited.");
      const merged = { ...previous, ...input };
      if ((merged.status === "harvested") !== Boolean(merged.actualHarvestDate)) {
        throw new HttpError(422, "HARVEST_DATE_REQUIRED", "An actual harvest date must be supplied only when harvesting the cycle.");
      }
      checkDates(merged.stockingDate, merged.expectedHarvestDate, merged.actualHarvestDate);
      return (await tx.update(stockingCycles).set(input).where(eq(stockingCycles.id, id)).returning())[0]!;
    }),
  };
}
