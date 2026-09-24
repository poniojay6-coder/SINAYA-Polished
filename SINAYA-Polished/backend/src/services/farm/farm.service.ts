import { and, eq } from "drizzle-orm";
import { farmContacts, farms } from "../../db/schema";
import type { Database } from "../../types/database";
import type { FarmCreate, FarmPatch, ContactCreate, ContactPatch, Page } from "../../validators/foundation";
import { required } from "../../utils/httpError";
import { coordinates, requireFarm, requireLanguage, requireOperator } from "../foundationChecks";

export function farmService(db: Database) {
  const get = async (id: string) => required((await db.select().from(farms).where(eq(farms.id, id)))[0], "Farm");
  return {
    get,
    list: (p: Page & { operatorId?: string }, actor: string) => db.select().from(farms).where(eq(farms.operatorId, actor)).orderBy(farms.id).limit(p.limit).offset(p.offset),
    async create(input: FarmCreate) {
      coordinates(input);
      await requireOperator(db, input.operatorId);
      return (await db.insert(farms).values(input).returning())[0]!;
    },
    async update(id: string, input: FarmPatch) {
      const previous = await get(id);
      coordinates({ ...previous, ...input });
      if (input.isActive) await requireOperator(db, previous.operatorId);
      return required((await db.update(farms).set(input).where(eq(farms.id, id)).returning())[0], "Farm");
    },
    async contacts(farmId: string, p: Page) {
      await get(farmId);
      return db.select().from(farmContacts).where(eq(farmContacts.farmId, farmId)).orderBy(farmContacts.id).limit(p.limit).offset(p.offset);
    },
    async createContact(farmId: string, input: ContactCreate) {
      await requireFarm(db, farmId);
      await requireLanguage(db, input.preferredLanguageCode);
      return (await db.insert(farmContacts).values({ ...input, farmId }).returning())[0]!;
    },
    async updateContact(farmId: string, id: string, input: ContactPatch) {
      const scope = and(eq(farmContacts.farmId, farmId), eq(farmContacts.id, id));
      required((await db.select().from(farmContacts).where(scope))[0], "Farm contact");
      if (input.isActive || input.receivesAlerts) await requireFarm(db, farmId);
      if (input.preferredLanguageCode) await requireLanguage(db, input.preferredLanguageCode);
      return required((await db.update(farmContacts).set(input).where(scope).returning())[0], "Farm contact");
    },
  };
}
