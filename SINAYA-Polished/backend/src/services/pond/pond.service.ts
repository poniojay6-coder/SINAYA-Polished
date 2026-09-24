import { and, eq, inArray } from "drizzle-orm";
import { farms, ponds } from "../../db/schema";
import type { Database } from "../../types/database";
import type { PondCreate, PondPatch, Page } from "../../validators/foundation";
import { required } from "../../utils/httpError";
import { coordinates, requireFarm } from "../foundationChecks";

export function pondService(db: Database) {
  const get = async (id: string) => required((await db.select().from(ponds).where(eq(ponds.id, id)))[0], "Pond");
  return {
    get,
    list: (p: Page & { farmId?: string }, actor: string) => db.select().from(ponds).where(and(inArray(ponds.farmId, db.select({ id: farms.id }).from(farms).where(eq(farms.operatorId, actor))), p.farmId ? eq(ponds.farmId, p.farmId) : undefined)).orderBy(ponds.id).limit(p.limit).offset(p.offset),
    async create(input: PondCreate) {
      coordinates(input);
      await requireFarm(db, input.farmId);
      return (await db.insert(ponds).values(input).returning())[0]!;
    },
    async update(id: string, input: PondPatch) {
      const previous = await get(id);
      coordinates({ ...previous, ...input });
      if (input.isActive) await requireFarm(db, previous.farmId);
      return required((await db.update(ponds).set(input).where(eq(ponds.id, id)).returning())[0], "Pond");
    },
  };
}
