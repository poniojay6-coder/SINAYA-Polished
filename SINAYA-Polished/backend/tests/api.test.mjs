import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import request from "supertest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { createApp } from "../dist/app.js";
import * as schema from "../dist/db/schema/index.js";

async function fixture(weatherProvider) {
  const client = new PGlite();
  for (const name of ["0000_foundation.sql", "0001_farm_centered_concept.sql", "0002_pond_sensors.sql", "0003_auth_advisory_workflow.sql", "0004_localization_drafts.sql"]) {
    await client.exec(await readFile(new URL(`../src/db/migrations/${name}`, import.meta.url), "utf8"));
  }
  await client.exec(`INSERT INTO languages (code, name, native_name, requires_native_review) VALUES
    ('en', 'English', 'English', false), ('fil', 'Filipino', 'Filipino', false), ('ceb', 'Cebuano', 'Bisaya', true);
    INSERT INTO region_languages (region_code, language_code) VALUES ('TEST', 'ceb');
    INSERT INTO species (name) VALUES ('Test tilapia');
    INSERT INTO equipment_catalog (name) VALUES ('Test aerator');`);
  const userId = randomUUID();
  return { client, api: request.agent(createApp(drizzle(client, { schema }), weatherProvider, { verify: async () => userId })).set('Authorization', 'Bearer test') };
}
const location = { region: "Test", province: "Test", municipalityCity: "Test", barangay: "Test" };
const operatorInput = { firstName: "Test", lastName: "Operator", mobileNumber: "+639171234567", preferredLanguageCode: "en", ...location };
const data = (response) => response.body.data;

test('weather route takes pond coordinates and handles provider failure without affecting sensors', async()=>{
  let coordinates;
  const {api,client}=await fixture({forecast:async(lat,lon)=>{coordinates=[lat,lon];throw Error('upstream failed');}});
  try {
    const operator=data(await api.post('/api/farmers').send(operatorInput).expect(201));
    const farm=data(await api.post('/api/farms').send({operatorId:operator.id,name:'Weather farm',...location}).expect(201));
    const pond=data(await api.post('/api/ponds').send({farmId:farm.id,name:'Weather pond',areaM2:100,waterType:'freshwater'}).expect(201));
    await api.get(`/api/ponds/${pond.id}/weather`).expect(422);
    await api.patch(`/api/ponds/${pond.id}`).send({latitude:7.1,longitude:125.6}).expect(200);
    const result=data(await api.get(`/api/ponds/${pond.id}/weather`).expect(200));
    assert.deepEqual(coordinates,[7.1,125.6]);assert.equal(result.status,'unavailable');
    await api.get(`/api/ponds/${pond.id}/weather?latitude=52.52`).expect(400);
    await api.get(`/api/ponds/${randomUUID()}/weather`).expect(404);
    await api.get(`/api/ponds/${pond.id}/readings/latest`).expect(200);
  } finally {await client.close();}
});

test("dedicated sensors retain history, separate simulation, reject invalid data and report freshness", async () => {
  const { api, client } = await fixture();
  try {
    const operator = data(await api.post('/api/farmers').send(operatorInput).expect(201));
    const farm = data(await api.post('/api/farms').send({ operatorId: operator.id, name: 'Sensor farm', ...location }).expect(201));
    const pond = data(await api.post('/api/ponds').send({ farmId: farm.id, name: 'Pond', areaM2: 1000, waterType: 'freshwater' }).expect(201));
    const latest = () => api.get(`/api/ponds/${pond.id}/readings/latest`);
    assert.equal(data(await latest().expect(200)).status, 'no_sensor');
    const sensor = data(await api.post(`/api/ponds/${pond.id}/sensors`).send({ serialNumber: 'UNIT-001' }).expect(201));
    await api.post(`/api/ponds/${pond.id}/sensors`).send({ serialNumber: 'UNIT-002' }).expect(409);
    assert.equal(data(await latest().expect(200)).status, 'missing');
    const reading = { observedAt: new Date(Date.now() - 60000).toISOString(), source: 'simulated', dissolvedOxygenMgL: 5.2, ph: 7.5, waterTemperatureC: 29 };
    const upload = (body) => api.post(`/api/sensors/${sensor.id}/readings`).send(body);
    const first = data(await upload(reading).expect(201));
    const retry = await upload(reading).expect(200);
    assert.equal(retry.body.duplicate, true);
    assert.equal(data(retry).id, first.id);
    await upload({ ...reading, ph: 8 }).expect(409);
    assert.equal(data(await latest().expect(200)).status, 'missing');
    assert.equal(data(await api.get(`/api/ponds/${pond.id}/readings/latest?source=simulated`).expect(200)).status, 'fresh');
    await upload({ ...reading, source: 'device', observedAt: new Date(Date.now() - 3600000).toISOString() }).expect(201);
    assert.equal(data(await latest().expect(200)).status, 'stale');
    await upload({ ...reading, source: 'device' }).expect(201);
    assert.equal(data(await latest().expect(200)).status, 'fresh');
    await upload({ ...reading, source: 'device', observedAt: new Date(Date.now() - 7200000).toISOString() }).expect(201);
    assert.equal(data(await latest().expect(200)).reading.observedAt, reading.observedAt);
    for (const change of [{ ph: 15 }, { dissolvedOxygenMgL: -1 }, { waterTemperatureC: 80 }, { source: undefined }, { pondId: pond.id }, { observedAt: 'bad' }]) await upload({ ...reading, ...change }).expect(400);
    await upload({ ...reading, observedAt: new Date(Date.now() + 600000).toISOString() }).expect(422);
    await api.post(`/api/ponds/${randomUUID()}/sensors/${sensor.id}/retire`).send({}).expect(404);
    await api.post(`/api/ponds/${pond.id}/sensors/${sensor.id}/retire`).send({}).expect(200);
    await upload({ ...reading, observedAt: new Date().toISOString() }).expect(409);
    const replacement = data(await api.post(`/api/ponds/${pond.id}/sensors`).send({ serialNumber: 'UNIT-002' }).expect(201));
    const current = data(await latest().expect(200));
    assert.equal(current.sensorId, replacement.id);
    assert.equal(current.status, 'missing');
    assert.equal(data(await api.get(`/api/ponds/${pond.id}/readings`).expect(200)).length, 3);
    assert.equal(data(await api.get(`/api/ponds/${pond.id}/readings?source=simulated`).expect(200)).length, 1);
    await api.patch(`/api/sensors/${sensor.id}/readings/${first.id}`).send({ ph: 8 }).expect(404);
    await api.get(`/api/ponds/${pond.id}/readings?limit=101`).expect(400);
  } finally { await client.close(); }
});

test("HTTP registration through farms, contacts, equipment, ponds, and historical stocking cycles", async () => {
  const { api, client } = await fixture();
  try {
    await api.get("/health").expect(200);
    await api.get("/ready").expect(200);
    const regional = data(await api.get("/api/languages?regionCode=TEST").expect(200));
    assert.deepEqual(regional.map((l) => l.code), ["ceb"]);
    assert.equal(regional[0].requiresNativeReview, true);
    const speciesId = data(await api.get("/api/species").expect(200))[0].id;
    const equipmentId = data(await api.get("/api/equipment").expect(200))[0].id;
    const operator = data(await api.post("/api/farmers").send(operatorInput).expect(201));
    assert.equal(operator.smsConsent, false);
    assert.equal(operator.preferredLanguageCode, "en");
    await api.patch(`/api/farmers/${operator.id}`).send({ smsConsent: true }).expect(200);
    assert.equal(data(await api.get(`/api/farmers/${operator.id}`).expect(200)).smsConsent, true);
    const farms = [];
    for (const name of ["Farm A", "Farm B"]) farms.push(data(await api.post("/api/farms").send({ operatorId: operator.id, name, ...location }).expect(201)));
    const listed = await api.get(`/api/farms?operatorId=${operator.id}&limit=1&offset=1`).expect(200);
    assert.equal(listed.body.data.length, 1);
    assert.equal(listed.body.pagination.limit, 1);
    const contact = data(await api.post(`/api/farms/${farms[0].id}/contacts`).send({ name: "Staff", mobileNumber: "+639181234567", preferredLanguageCode: "ceb" }).expect(201));
    assert.equal(contact.smsConsent, false);
    assert.equal(contact.receivesAlerts, false);
    await api.patch(`/api/farms/${farms[1].id}/contacts/${contact.id}`).send({ name: "Wrong farm" }).expect(404);
    await api.patch(`/api/farms/${farms[0].id}/contacts/${contact.id}`).send({ receivesAlerts: true, smsConsent: true }).expect(200);
    assert.equal(data(await api.get(`/api/farms/${farms[1].id}/contacts`).expect(200)).length, 0);
    const tool = data(await api.post(`/api/farmers/${operator.id}/equipment`).send({ equipmentId }).expect(201));
    await api.post(`/api/farmers/${operator.id}/equipment`).send({ equipmentId }).expect(409);
    await api.post(`/api/farmers/${operator.id}/equipment`).send({ customName: "Solar aerator" }).expect(201);
    await api.post(`/api/farmers/${operator.id}/equipment`).send({ customName: " solar AERATOR " }).expect(409);
    await api.patch(`/api/farmers/${operator.id}/equipment/${tool.id}`).send({ quantity: 2 }).expect(200);
    assert.equal(data(await api.get(`/api/farmers/${operator.id}/equipment`).expect(200)).length, 2);
    assert.equal(data(await api.get("/api/equipment").expect(200)).length, 1);
    const pond = data(await api.post("/api/ponds").send({ farmId: farms[0].id, name: "Pond 1", areaM2: 1000, waterType: "freshwater", latitude: 7.1, longitude: 125.6 }).expect(201));
    const cycle = data(await api.post("/api/stocking-cycles").send({ pondId: pond.id, speciesId, quantityStocked: 2000, stockingDate: "2026-01-01", expectedHarvestDate: "2026-06-01" }).expect(201));
    assert.equal(Number(cycle.stockingDensityPerM2), 2);
    await api.patch(`/api/ponds/${pond.id}`).send({ areaM2: 2000 }).expect(200);
    assert.equal(Number(data(await api.get(`/api/stocking-cycles/${cycle.id}`).expect(200)).stockingDensityPerM2), 2);
    await api.patch(`/api/stocking-cycles/${cycle.id}`).send({ status: "harvested" }).expect(422);
    await api.patch(`/api/stocking-cycles/${cycle.id}`).send({ status: "harvested", actualHarvestDate: "2025-01-01" }).expect(422);
    await api.patch(`/api/stocking-cycles/${cycle.id}`).send({ status: "harvested", actualHarvestDate: "2026-06-02" }).expect(200);
    await api.patch(`/api/stocking-cycles/${cycle.id}`).send({ expectedHarvestDate: "2026-07-01" }).expect(409);
    const second = data(await api.post("/api/stocking-cycles").send({ pondId: pond.id, speciesId, quantityStocked: 6000, stockingDate: "2026-07-01" }).expect(201));
    assert.equal(Number(second.stockingDensityPerM2), 3);
    await api.patch(`/api/stocking-cycles/${second.id}`).send({ status: "cancelled" }).expect(200);
    assert.equal(data(await api.get(`/api/stocking-cycles?pondId=${pond.id}`).expect(200)).length, 2);
    await api.delete(`/api/ponds/${pond.id}`).expect(404);
    await api.patch(`/api/farms/${farms[0].id}`).send({ isActive: false }).expect(200);
    await api.post("/api/ponds").send({ farmId: farms[0].id, name: "Blocked", areaM2: 20, waterType: "freshwater" }).expect(409);
    await api.post("/api/stocking-cycles").send({ pondId: pond.id, speciesId, quantityStocked: 1, stockingDate: "2026-08-01" }).expect(409);
  } finally { await client.close(); }
});

test("HTTP validation rejects malformed requests and prevents protected-field edits", async () => {
  const { api, client } = await fixture();
  try {
    await api.get("/api/ponds/not-a-uuid").expect(403);
    await api.post("/api/farmers").send({ ...operatorInput, latitude: 7 }).expect(422);
    await api.post("/api/farmers").send({ ...operatorInput, smsConsent: "false" }).expect(400);
    await api.post("/api/farmers").send({ ...operatorInput, mobileNumber: "bad" }).expect(400);
    await api.post("/api/farmers").send({ ...operatorInput, preferredLanguageCode: "missing" }).expect(404);
    await api.post("/api/farmers").send({ ...operatorInput, id: randomUUID() }).expect(400);
    await api.post("/api/farmers").type("json").send('{"broken":').expect(400);
    await api.post("/api/farmers").type("text").send("not json").expect(415);
    await api.post("/api/farmers").send({ ...operatorInput, firstName: "x".repeat(40000) }).expect(413);
    const operator = data(await api.post("/api/farmers").send(operatorInput).expect(201));
    await api.get("/api/ponds/not-a-uuid").expect(400);
    await api.get(`/api/ponds/${randomUUID()}`).expect(404);
    await api.get("/api/farms?limit=101").expect(400);
    await api.get("/api/farms?offset=-1").expect(400);
    await api.get("/api/farms?unknown=true").expect(400);
    await api.patch(`/api/farmers/${operator.id}`).send({}).expect(400);
    await api.post(`/api/farmers/${operator.id}/equipment`).send({}).expect(400);
    await api.post(`/api/farmers/${operator.id}/equipment`).send({ equipmentId: randomUUID(), customName: "Both" }).expect(400);
    const farm = data(await api.post("/api/farms").send({ operatorId: operator.id, name: "Test farm", ...location }).expect(201));
    await api.patch(`/api/farms/${farm.id}`).send({ operatorId: randomUUID() }).expect(400);
    const pondInput = { farmId: farm.id, name: "Test pond", areaM2: 1000, waterType: "freshwater" };
    await api.post("/api/ponds").send({ ...pondInput, areaM2: 0 }).expect(400);
    await api.post("/api/ponds").send({ ...pondInput, areaM2: 10.001 }).expect(400);
    const pond = data(await api.post("/api/ponds").send(pondInput).expect(201));
    await api.patch(`/api/ponds/${pond.id}`).send({ farmId: randomUUID() }).expect(400);
    const speciesId = data(await api.get("/api/species").expect(200))[0].id;
    const cycleInput = { pondId: pond.id, speciesId, quantityStocked: 2000, stockingDate: "2026-01-01" };
    await api.post("/api/stocking-cycles").send({ ...cycleInput, stockedAreaM2: 1 }).expect(400);
    await api.post("/api/stocking-cycles").send({ ...cycleInput, stockingDate: "2026-02-30" }).expect(400);
    await api.post("/api/stocking-cycles").send({ ...cycleInput, expectedHarvestDate: "2025-01-01" }).expect(422);
    const cycle = data(await api.post("/api/stocking-cycles").send(cycleInput).expect(201));
    await api.patch(`/api/stocking-cycles/${cycle.id}`).send({ quantityStocked: 3 }).expect(400);
    await api.patch(`/api/stocking-cycles/${cycle.id}`).send({ actualHarvestDate: "2026-07-01" }).expect(422);
    await api.patch(`/api/ponds/${pond.id}`).send({ latitude: null, longitude: null }).expect(200);
    await client.exec(`UPDATE languages SET is_active = false WHERE code = 'fil';`);
    assert.equal(data(await api.get("/api/languages").expect(200)).some((l) => l.code === "fil"), false);
    await api.patch(`/api/farmers/${operator.id}`).send({ preferredLanguageCode: "fil" }).expect(409);
    await api.patch(`/api/farmers/${operator.id}`).send({ accountStatus: "inactive" }).expect(200);
    await api.post("/api/farms").send({ operatorId: operator.id, name: "Blocked", ...location }).expect(403);
  } finally { await client.close(); }
});

test("health is independent of the database; failures are sanitized", async () => {
  const secret = "postgresql://private:password@host/database";
  const db = {
    execute: async () => { throw new Error(secret); },
    select: () => { throw Object.assign(new Error(secret), { cause: { code: "ENOTFOUND" } }); },
  };
  const api = request.agent(createApp(db, undefined, { verify: async () => randomUUID() })).set('Authorization', 'Bearer test');
  await api.get("/health").expect(200);
  for (const path of ["/ready", "/api/farmers"]) {
    const response = await api.get(path).expect(503);
    assert.equal(response.text.includes(secret), false);
    assert.equal(response.body.error.code, "DATABASE_UNAVAILABLE");
  }
  await api.get("/unknown").expect(404);
});
