import { and, eq } from "drizzle-orm";
import { farmers } from "../../db/schema";
import type { Database } from "../../types/database";
import type { FarmerCreate, FarmerPatch, Page } from "../../validators/foundation";
import { required } from "../../utils/httpError";
import { coordinates, requireLanguage } from "../foundationChecks";

export function farmerService(db: Database) {
  const get = async (id: string) => required((await db.select().from(farmers).where(eq(farmers.id, id)))[0], "Operator");
  return {
    get,
    list: (p: Page & { accountStatus?: string }, actor: string) => db.select().from(farmers).where(and(eq(farmers.id, actor), p.accountStatus ? eq(farmers.accountStatus, p.accountStatus) : undefined)).orderBy(farmers.id).limit(p.limit).offset(p.offset),
    async create(input: FarmerCreate, authUserId: string) {
      coordinates(input);
      await requireLanguage(db, input.preferredLanguageCode);
      return (await db.insert(farmers).values({ ...input, authUserId }).returning())[0]!;
    },
    async update(id: string, input: FarmerPatch) {
      coordinates({ ...await get(id), ...input });
      if (input.preferredLanguageCode) await requireLanguage(db, input.preferredLanguageCode);
      return required((await db.update(farmers).set(input).where(eq(farmers.id, id)).returning())[0], "Operator");
    },
  };
}
