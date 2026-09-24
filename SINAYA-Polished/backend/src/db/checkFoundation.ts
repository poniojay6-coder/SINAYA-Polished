import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { createDatabase } from "./index";
import { equipmentCatalog, farmContacts, farmerEquipment, farmers, farms, languages, ponds, regionLanguages, species, stockingCycles } from "./schema";

async function main() {
  const connection = createDatabase();
  const rollback = new Error("Roll back smoke-test fixtures");
  const suffix = randomUUID();
  try {
    try {
      await connection.db.transaction(async (tx) => {
        const [language] = await tx.insert(languages).values({
          code: `test-${suffix}`, name: "Test language", nativeName: "Test language",
        }).returning();
        await tx.insert(regionLanguages).values({ regionCode: `test-${suffix}`, languageCode: language!.code });
        const [fish] = await tx.insert(species).values({ name: `Test species ${suffix}` }).returning();
        const [tool] = await tx.insert(equipmentCatalog).values({ name: `Test equipment ${suffix}` }).returning();
        const [farmer] = await tx.insert(farmers).values({
          firstName: "Test", lastName: "Farmer", mobileNumber: "TEST-NOT-A-PHONE",
          region: "Test", province: "Test", municipalityCity: "Test", barangay: "Test",
          preferredLanguageCode: language!.code,
        }).returning();
        assert.equal(farmer!.smsConsent, false);
        const [farm] = await tx.insert(farms).values({
          operatorId: farmer!.id, name: "Test commercial farm",
          region: "Test", province: "Test", municipalityCity: "Test", barangay: "Test",
        }).returning();
        const [contact] = await tx.insert(farmContacts).values({
          farmId: farm!.id, name: "Test farm contact", mobileNumber: "TEST-NOT-A-PHONE",
          preferredLanguageCode: language!.code,
        }).returning();
        assert.equal(contact!.smsConsent, false);
        assert.equal(contact!.receivesAlerts, false);
        assert.equal((await tx.select().from(farmContacts).where(eq(farmContacts.farmId, farm!.id))).length, 1);
        await tx.insert(farmerEquipment).values([
          { farmerId: farmer!.id, equipmentId: tool!.id },
          { farmerId: farmer!.id, customName: `Custom tool ${suffix}` },
        ]);
        assert.equal((await tx.select().from(farmerEquipment).where(eq(farmerEquipment.farmerId, farmer!.id))).length, 2);
        assert.equal((await tx.select().from(regionLanguages).where(eq(regionLanguages.languageCode, language!.code))).length, 1);
        const [pond] = await tx.insert(ponds).values({
          farmId: farm!.id, name: "Test pond", areaM2: "1000", waterType: "freshwater",
        }).returning();
        await tx.insert(stockingCycles).values([
          { pondId: pond!.id, speciesId: fish!.id, quantityStocked: 2000, stockedAreaM2: "1000", stockingDate: "2025-01-01", actualHarvestDate: "2025-06-01", status: "harvested" },
          { pondId: pond!.id, speciesId: fish!.id, quantityStocked: 3000, stockedAreaM2: "1000", stockingDate: "2025-07-01" },
        ]);
        await tx.update(ponds).set({ areaM2: "2000" }).where(eq(ponds.id, pond!.id));
        const cycles = await tx.select().from(stockingCycles).where(eq(stockingCycles.pondId, pond!.id));
        assert.equal(cycles.length, 2);
        assert.deepEqual(cycles.map((cycle) => Number(cycle.stockingDensityPerM2)).sort(), [2, 3]);

        // Savepoints allow intentional constraint failures without aborting the outer transaction.
        async function rejectsConstraint(run: (nested: typeof tx) => Promise<unknown>, code: string | string[]) {
          await assert.rejects(() => tx.transaction(run), (error: unknown) => {
            const failure = error as { code?: string; cause?: { code?: string } };
            return [code].flat().includes(failure.code ?? failure.cause?.code ?? "");
          });
        }
        await rejectsConstraint((nested) => nested.insert(farmerEquipment).values({ farmerId: farmer!.id }), "23514");
        await rejectsConstraint((nested) => nested.insert(farmerEquipment).values({ farmerId: farmer!.id, equipmentId: tool!.id, customName: "Invalid combination" }), "23514");
        await rejectsConstraint((nested) => nested.insert(farmerEquipment).values({ farmerId: farmer!.id, equipmentId: tool!.id }), "23505");
        await rejectsConstraint((nested) => nested.update(ponds).set({ areaM2: "0" }).where(eq(ponds.id, pond!.id)), "23514");
        await rejectsConstraint((nested) => nested.update(stockingCycles).set({ actualHarvestDate: "2024-01-01" }).where(eq(stockingCycles.pondId, pond!.id)), "23514");
        await rejectsConstraint((nested) => nested.delete(ponds).where(eq(ponds.id, pond!.id)), ["23503", "23001"]);
        await rejectsConstraint((nested) => nested.delete(farms).where(eq(farms.id, farm!.id)), ["23503", "23001"]);
        await rejectsConstraint((nested) => nested.update(farmContacts).set({ farmId: randomUUID() }).where(eq(farmContacts.id, contact!.id)), "23503");
        await rejectsConstraint((nested) => nested.insert(languages).values({ code: `ceb-${suffix}`, name: "Cebuano", nativeName: "Bisaya", requiresNativeReview: false }), "23514");
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
    assert.equal((await connection.db.select().from(languages).where(eq(languages.code, `test-${suffix}`))).length, 0);
    console.log("Foundation inserts/selects, historical density, and constraints passed. Test fixtures rolled back.");
  } finally {
    await connection.close();
  }
}

main().catch(() => {
  console.error("Foundation smoke check failed. Confirm the connection, applied migration, database role, and schema constraints. Credentials and row data are omitted.");
  process.exitCode = 1;
});
