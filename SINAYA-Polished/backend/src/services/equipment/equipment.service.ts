import { and, eq } from "drizzle-orm";
import { equipmentCatalog, farmerEquipment, farmers } from "../../db/schema";
import type { Database } from "../../types/database";
import type { EquipmentCreate, Page } from "../../validators/foundation";
import { required } from "../../utils/httpError";
import { active, requireOperator } from "../foundationChecks";

export function equipmentService(db: Database) {
  return {
    async list(farmerId: string, p: Page) {
      required((await db.select({ id: farmers.id }).from(farmers).where(eq(farmers.id, farmerId)))[0], "Operator");
      return db.select().from(farmerEquipment).where(eq(farmerEquipment.farmerId, farmerId)).orderBy(farmerEquipment.id).limit(p.limit).offset(p.offset);
    },
    async create(farmerId: string, input: EquipmentCreate) {
      await requireOperator(db, farmerId);
      if (input.equipmentId) {
        const tool = required((await db.select().from(equipmentCatalog).where(eq(equipmentCatalog.id, input.equipmentId)))[0], "Equipment");
        active(tool.isActive, "Equipment");
      }
      return (await db.insert(farmerEquipment).values({ ...input, farmerId }).returning())[0]!;
    },
    async update(farmerId: string, id: string, quantity: number) {
      return required((await db.update(farmerEquipment).set({ quantity }).where(and(eq(farmerEquipment.farmerId, farmerId), eq(farmerEquipment.id, id))).returning())[0], "Farmer equipment");
    },
  };
}
