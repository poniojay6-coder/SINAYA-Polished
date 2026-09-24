import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const migrationDir = new URL("../src/db/migrations/", import.meta.url);
async function migrate(db, file) {
  const sql = await readFile(new URL(file, migrationDir), "utf8");
  await db.transaction(async (tx) => { await tx.exec(sql); });
}
async function row(db, sql, params = []) { return (await db.query(sql, params)).rows[0]; }
async function addOperator(db, firstName) {
  return row(db, `INSERT INTO farmers
    (first_name, last_name, mobile_number, region, province, municipality_city, barangay, preferred_language_code)
    VALUES ($1, 'Test', 'TEST-NOT-A-PHONE', 'Test region', 'Test province', 'Test city', 'Test barangay', 'en') RETURNING *`, [firstName]);
}
async function rejects(db, sql, params, code) {
  await assert.rejects(() => db.query(sql, params), (error) => [code].flat().includes(error.code));
}

test("fresh schema supports multiple farms, pond history, contacts, and review gates", async () => {
  const db = new PGlite();
  try {
    await migrate(db, "0000_foundation.sql");
    await migrate(db, "0001_farm_centered_concept.sql");
    await db.exec(`INSERT INTO languages (code, name, native_name) VALUES ('en', 'English', 'English');`);
    const operator = await addOperator(db, "Operator");
    assert.equal(operator.sms_consent, false);
    const farms = [];
    for (const name of ["Farm A", "Farm B"]) {
      farms.push(await row(db, `INSERT INTO farms (operator_id, name, region, province, municipality_city, barangay)
        VALUES ($1, $2, 'Region', 'Province', 'City', 'Barangay') RETURNING *`, [operator.id, name]));
    }
    const pond = await row(db, `INSERT INTO ponds (farm_id, name, area_m2, water_type)
      VALUES ($1, 'Pond A', 1000, 'freshwater') RETURNING *`, [farms[0].id]);
    await db.query(`INSERT INTO ponds (farm_id, name, area_m2, water_type) VALUES ($1, 'Pond B', 800, 'brackish')`, [farms[1].id]);
    const contact = await row(db, `INSERT INTO farm_contacts (farm_id, name, mobile_number, preferred_language_code)
      VALUES ($1, 'Staff', 'TEST-NOT-A-PHONE', 'en') RETURNING *`, [farms[1].id]);
    assert.equal(contact.sms_consent, false);
    assert.equal(contact.receives_alerts, false);
    assert.equal(farms[0].notify_operator, true);
    await db.query(`UPDATE farms SET notify_operator = false WHERE id = $1`, [farms[1].id]);
    await db.query(`UPDATE farm_contacts SET sms_consent = true, receives_alerts = true WHERE id = $1`, [contact.id]);
    assert.equal((await row(db, `SELECT count(*)::int AS count FROM ponds p JOIN farms f ON p.farm_id = f.id WHERE f.operator_id = $1`, [operator.id])).count, 2);
    const fish = await row(db, `INSERT INTO species (name) VALUES ('Test fish') RETURNING *`);
    await db.query(`INSERT INTO stocking_cycles (pond_id, species_id, quantity_stocked, stocked_area_m2, stocking_date, actual_harvest_date, status)
      VALUES ($1, $2, 2000, 1000, '2025-01-01', '2025-06-01', 'harvested'),
             ($1, $2, 3000, 1000, '2025-07-01', NULL, 'active')`, [pond.id, fish.id]);
    await db.query(`UPDATE ponds SET area_m2 = 2000 WHERE id = $1`, [pond.id]);
    const cycles = (await db.query(`SELECT stocking_density_per_m2 FROM stocking_cycles WHERE pond_id = $1 ORDER BY stocking_date`, [pond.id])).rows;
    assert.deepEqual(cycles.map((r) => Number(r.stocking_density_per_m2)), [2, 3]);
    await rejects(db, `UPDATE ponds SET farm_id = '00000000-0000-0000-0000-000000000000' WHERE id = $1`, [pond.id], "23503");
    await rejects(db, `UPDATE ponds SET farm_id = NULL WHERE id = $1`, [pond.id], "23502");
    await rejects(db, `DELETE FROM farms WHERE id = $1`, [farms[0].id], ["23503", "23001"]);
    await rejects(db, `DELETE FROM farmers WHERE id = $1`, [operator.id], ["23503", "23001"]);
    await rejects(db, `UPDATE farm_contacts SET name = ' ' WHERE id = $1`, [contact.id], "23514");
    await rejects(db, `UPDATE farm_contacts SET preferred_language_code = 'missing' WHERE id = $1`, [contact.id], "23503");
    await rejects(db, `INSERT INTO languages (code, name, native_name) VALUES ('ceb', 'Cebuano', 'Bisaya')`, [], "23514");
    await db.exec(`INSERT INTO languages (code, name, native_name, requires_native_review) VALUES ('ceb', 'Cebuano', 'Bisaya', true);`);
    await rejects(db, `UPDATE languages SET requires_native_review = false WHERE code = 'ceb'`, [], "23514");
    await rejects(db, `UPDATE ponds SET area_m2 = 0 WHERE id = $1`, [pond.id], "23514");
    await rejects(db, `UPDATE stocking_cycles SET actual_harvest_date = '2024-01-01' WHERE pond_id = $1`, [pond.id], "23514");
    const tool = await row(db, `INSERT INTO equipment_catalog (name) VALUES ('Test tool') RETURNING *`);
    await db.query(`INSERT INTO farmer_equipment (farmer_id, equipment_id) VALUES ($1, $2)`, [operator.id, tool.id]);
    await db.query(`INSERT INTO farmer_equipment (farmer_id, custom_name) VALUES ($1, 'Custom pump')`, [operator.id]);
    await rejects(db, `INSERT INTO farmer_equipment (farmer_id, equipment_id) VALUES ($1, $2)`, [operator.id, tool.id], "23505");
    await rejects(db, `INSERT INTO farmer_equipment (farmer_id, equipment_id, custom_name) VALUES ($1, $2, 'Both')`, [operator.id, tool.id], "23514");
    // Check the actual migrated RLS behavior, not only the schema flag.
    await db.exec(`CREATE ROLE preview_client; GRANT USAGE ON SCHEMA public TO preview_client; GRANT SELECT ON ALL TABLES IN SCHEMA public TO preview_client; SET ROLE preview_client;`);
    assert.equal((await row(db, `SELECT count(*)::int AS count FROM farms`)).count, 0);
    assert.equal((await row(db, `SELECT count(*)::int AS count FROM farm_contacts`)).count, 0);
    await db.exec(`RESET ROLE;`);
  } finally { await db.close(); }
});

test("upgrade backfills farms without changing pond IDs, ownership, stock history, or equipment", async () => {
  const db = new PGlite();
  try {
    await migrate(db, "0000_foundation.sql");
    await db.exec(`INSERT INTO languages (code, name, native_name) VALUES ('en', 'English', 'English'), ('ceb', 'Cebuano', 'Bisaya');`);
    const a = await addOperator(db, "Operator A");
    const b = await addOperator(db, "Operator B");
    await addOperator(db, "No ponds yet");
    for (const [operator, name] of [[a, 'A1'], [a, 'A2'], [b, 'B1']]) {
      await db.query(`INSERT INTO ponds (farmer_id, name, area_m2, water_type) VALUES ($1, $2, 1000, 'freshwater')`, [operator.id, name]);
    }
    const before = (await db.query(`SELECT id, farmer_id, name, area_m2, created_at FROM ponds ORDER BY name`)).rows;
    const fish = await row(db, `INSERT INTO species (name) VALUES ('Test fish') RETURNING *`);
    const cycle = await row(db, `INSERT INTO stocking_cycles (pond_id, species_id, quantity_stocked, stocked_area_m2, stocking_date)
      VALUES ($1, $2, 2000, 1000, '2025-01-01') RETURNING *`, [before[0].id, fish.id]);
    await db.query(`INSERT INTO farmer_equipment (farmer_id, custom_name) VALUES ($1, 'Existing pump')`, [a.id]);
    await migrate(db, "0001_farm_centered_concept.sql");
    const after = (await db.query(`SELECT p.id, f.operator_id AS farmer_id, p.name, p.area_m2, p.created_at FROM ponds p JOIN farms f ON f.id = p.farm_id ORDER BY p.name`)).rows;
    assert.deepEqual(after, before);
    assert.equal((await row(db, `SELECT count(*)::int AS count FROM farms`)).count, 2);
    assert.equal((await row(db, `SELECT count(*)::int AS count FROM farms WHERE operator_id = $1`, [a.id])).count, 1);
    assert.deepEqual(await row(db, `SELECT * FROM stocking_cycles WHERE id = $1`, [cycle.id]), cycle);
    assert.equal((await row(db, `SELECT custom_name FROM farmer_equipment WHERE farmer_id = $1`, [a.id])).custom_name, "Existing pump");
    assert.equal((await row(db, `SELECT requires_native_review FROM languages WHERE code = 'ceb'`)).requires_native_review, true);
    assert.equal((await row(db, `SELECT requires_native_review FROM languages WHERE code = 'en'`)).requires_native_review, false);
    assert.equal((await row(db, `SELECT count(*)::int AS count FROM information_schema.columns WHERE table_name = 'ponds' AND column_name = 'farmer_id'`)).count, 0);
  } finally { await db.close(); }
});
