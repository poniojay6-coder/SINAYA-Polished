import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import request from 'supertest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createApp } from '../dist/app.js';
import { seedCatalogs } from '../dist/db/seed/catalogs.js';
import { workflowService } from '../dist/services/advisory/workflow.service.js';
import * as schema from '../dist/db/schema/index.js';

const data = response => response.body.data;
const location = { region:'Test',province:'Test',municipalityCity:'Test',barangay:'Test' };
async function setup() {
  const client = new PGlite();
  const journal = JSON.parse(await readFile(new URL('../src/db/migrations/meta/_journal.json',import.meta.url),'utf8'));
  for (const entry of journal.entries) await client.exec(await readFile(new URL(`../src/db/migrations/${entry.tag}.sql`,import.meta.url),'utf8'));
  const db = drizzle(client,{schema});
  await seedCatalogs(db); await seedCatalogs(db);
  const ids = { alpha:randomUUID(), beta:randomUUID() };
  const app = createApp(db,{forecast:async()=>{throw Error('Offline weather');}},{verify:async token=>{
    if(!ids[token]) { const error = new Error('Invalid test identity'); throw error; }
    return ids[token];
  }});
  const a=request.agent(app).set('Authorization','Bearer alpha');
  const b=request.agent(app).set('Authorization','Bearer beta');
  async function register(api,name) {
    const operator=data(await api.post('/api/farmers').send({firstName:name,lastName:'Test',mobileNumber:'+639171234567',preferredLanguageCode:'en',smsConsent:true,...location}).expect(201));
    const farm=data(await api.post('/api/farms').send({operatorId:operator.id,name,...location}).expect(201));
    const pond=data(await api.post('/api/ponds').send({farmId:farm.id,name,areaM2:1000,waterType:'freshwater'}).expect(201));
    return {operator,farm,pond};
  }
  return {client,db,app,a,b,register};
}

test('operator isolation includes list queries, parent spoofing, case variations and onboarding',async()=>{
  const {client,app,a,b,register}=await setup();
  try {
    await request(app).get('/api/farms').expect(401);
    await request(app).get('/health').expect(200);
    await request(app).options('/api/farms').set('Origin','http://localhost:5173').expect(204);
    await request(app).get('/health').set('Origin','https://untrusted.example').expect(403);
    assert.equal(data(await a.get('/auth/me').expect(404)),undefined);
    assert.equal(data(await a.get('/api/auth/me').expect(200)).operator,null);
    const owner=await register(a,'Alpha'); const other=await register(b,'Beta');
    assert.equal(data(await a.get('/api/farmers').expect(200)).length,1);
    assert.equal(data(await a.get('/api/farms').expect(200))[0].id,owner.farm.id);
    assert.equal(data(await a.get('/api/ponds').expect(200))[0].id,owner.pond.id);
    for(const path of [`/api/farms/${other.farm.id}`,`/api/FARMS/${other.farm.id}`,`/api/ponds/${other.pond.id}/weather`,`/api/farmers/${other.operator.id}`]) await a.get(path).expect(404);
    await a.get(`/api/ponds?farmId=${other.farm.id}`).expect(404);
    await a.post('/api/ponds').send({farmId:other.farm.id,name:'Spoofed',areaM2:100,waterType:'freshwater'}).expect(404);
    await a.post('/api/farms').send({operatorId:other.operator.id,name:'Spoofed',...location}).expect(404);
    await a.post('/api/farmers').send({}).expect(409);
    const sensor=data(await b.post(`/api/ponds/${other.pond.id}/sensors`).send({serialNumber:'OTHER'}).expect(201));
    await a.post(`/api/sensors/${sensor.id}/readings`).send({}).expect(404);
    await a.get(`/api/ponds/${other.pond.id}/assessments`).expect(404);
    assert.equal(data(await a.get('/api/languages').expect(200)).length,3);
  } finally { await client.close(); }
});

test('assessment-to-simulated-SMS workflow is historical, consent-aware, and review gated',async()=>{
  const {client,db,a,b,register}=await setup();
  try {
    const owner=await register(a,'Alpha'); await register(b,'Beta');
    const speciesId=data(await a.get('/api/species').expect(200))[0].id;
    const equipmentId=data(await a.get('/api/equipment').expect(200))[0].id;
    const cycle=data(await a.post('/api/stocking-cycles').send({pondId:owner.pond.id,speciesId,quantityStocked:2000,stockingDate:'2026-01-01'}).expect(201));
    const sensor=data(await a.post(`/api/ponds/${owner.pond.id}/sensors`).send({serialNumber:'SYNTHETIC-TEST-ONLY'}).expect(201));
    const reading={source:'simulated',observedAt:new Date(Date.now()-1000).toISOString(),dissolvedOxygenMgL:2,ph:7,waterTemperatureC:28};
    await a.post(`/api/sensors/${sensor.id}/readings`).send(reading).expect(201);
    const root=`/api/ponds/${owner.pond.id}/assessments`;
    const evaluate=body=>a.post(root).send({cycleId:cycle.id,source:'simulated',...body});
    const before=data(await evaluate().expect(201));
    assert.equal(before.status,'review_required');
    const blocked=data(await a.post(`${root}/${before.id}/advisories`).send({languageCode:'en'}).expect(201));
    assert.equal(blocked.status,'review_required');assert.equal(blocked.finalText,null);
    await a.post(`${root}/${before.id}/advisories/${blocked.id}/simulate`).send({}).expect(409);
    // Deliberately synthetic, non-medical values/instructions, isolated to this test database.
    const rule=(await client.query(`INSERT INTO threshold_rules (species_id,water_type,version,density_max,do_min,ph_min,ph_max,temperature_min,temperature_max,weather_rain_watch_mm,weather_heat_watch_c,weather_wind_watch_kmh,approval_status,reviewed_by,reviewed_at)
      VALUES ($1,'freshwater',1,100,4,6,9,20,40,10,35,50,'approved','SYNTHETIC TEST FIXTURE',now()) RETURNING id`,[speciesId])).rows[0];
    const action=(await client.query(`INSERT INTO action_library (rule_id,risk_type,instruction,effectiveness,automatic_eligible,approval_status,reviewed_by,reviewed_at)
      VALUES ($1,'low_oxygen','TEST ONLY: record this simulated event.',50,true,'approved','SYNTHETIC TEST FIXTURE',now()) RETURNING id`,[rule.id])).rows[0];
    const stronger=(await client.query(`INSERT INTO action_library (rule_id,risk_type,instruction,effectiveness,automatic_eligible,approval_status,reviewed_by,reviewed_at)
      VALUES ($1,'low_oxygen','TEST ONLY: equipment-dependent fixture.',90,true,'approved','SYNTHETIC TEST FIXTURE',now()) RETURNING id`,[rule.id])).rows[0];
    await client.query('INSERT INTO action_equipment (action_id,equipment_id) VALUES ($1,$2)',[stronger.id,equipmentId]);
    await evaluate({availableEquipmentIds:[equipmentId]}).expect(422);
    const evaluated=data(await evaluate().expect(201));
    assert.equal(evaluated.status,'warning');assert.equal(evaluated.confidence,'standard');
    assert.equal(evaluated.snapshot.selectedActions[0].id,action.id);
    assert.equal(evaluated.snapshot.candidates[0].feasible,false);
    assert.equal(data(await a.get(`${root}/${before.id}`).expect(200)).status,'review_required');
    const advisory=data(await a.post(`${root}/${evaluated.id}/advisories`).send({languageCode:'en'}).expect(201));
    assert.equal(advisory.status,'ready');assert.match(advisory.finalText,/SIMULATED DATA/);assert.match(advisory.finalText,/DO: 2 mg\/L/);
    assert.equal(data(await a.post(`${root}/${evaluated.id}/advisories`).send({languageCode:'en'}).expect(201)).id,advisory.id);
    const ceb=data(await a.post(`${root}/${evaluated.id}/advisories`).send({languageCode:'ceb'}).expect(201));
    assert.equal(ceb.status,'review_required');
    const workflow = workflowService(db, {forecast:async()=>{throw Error('offline');}}, {translate:async()=> 'UNAPPROVED TEST TRANSLATION'});
    const draft = await workflow.draft(owner.pond.id,evaluated.id,ceb.id);
    assert.equal(draft.generationStatus,'draft');assert.equal(draft.finalText,null);assert.equal(draft.status,'review_required');
    await a.post(`${root}/${evaluated.id}/advisories/${ceb.id}/simulate`).send({}).expect(409);
    const contact=data(await a.post(`/api/farms/${owner.farm.id}/contacts`).send({name:'No consent',mobileNumber:'+639181234567',preferredLanguageCode:'en',receivesAlerts:true}).expect(201));
    const send=()=>a.post(`${root}/${evaluated.id}/advisories/${advisory.id}/simulate`).send({});
    const first=data(await send().expect(200));assert.equal(first.deliveries.length,1);assert.equal(first.simulated,true);
    assert.equal(first.deliveries[0].maskedPhone.includes('+639171234567'),false);
    assert.equal(data(await send().expect(200)).deliveries.length,1);
    await a.patch(`/api/farms/${owner.farm.id}/contacts/${contact.id}`).send({smsConsent:true}).expect(200);
    assert.equal(data(await send().expect(200)).deliveries.length,2);
    await b.post(`${root}/${evaluated.id}/advisories/${advisory.id}/simulate`).send({}).expect(404);
    await client.query("UPDATE action_library SET approval_status='retired' WHERE id=$1",[action.id]);
    await send().expect(409);
    await client.query("UPDATE action_library SET approval_status='approved' WHERE id=$1",[action.id]);
    await a.post(`/api/sensors/${sensor.id}/readings`).send({...reading,observedAt:new Date().toISOString()}).expect(201);
    await send().expect(409);
  } finally { await client.close(); }
});
