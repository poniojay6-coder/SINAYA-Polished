// Explicit live smoke check: real configured database, isolated rollback transaction.
// Authentication is injected for this in-process test; it does not bypass server auth.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createDatabase } from '../dist/db/index.js';
import { createApp } from '../dist/app.js';
import { languages, species } from '../dist/db/schema/index.js';

const connection = createDatabase();
const rollback = new Error('Rollback test records');
try {
  try {
    await connection.db.transaction(async tx => {
      const userId = randomUUID();
      const languageCode = `test-${userId}`;
      await tx.insert(languages).values({ code: languageCode, name: 'Test', nativeName: 'Test' });
      const [fish] = await tx.insert(species).values({ name: `Test ${userId}` }).returning();
      const api = request.agent(createApp(tx, undefined, { verify: async () => userId })).set('Authorization', 'Bearer isolated-test');
      const data = async (method, path, body, status) => {
        const response = await api[method](`/api${path}`).send(body);
        assert.equal(response.status, status, `${method} ${path}: unexpected status`);
        return response.body.data;
      };
      const address = { region: 'Test region', province: 'Test province', municipalityCity: 'Test city', barangay: 'Test barangay' };
      const operator = await data('post', '/farmers', { ...address, firstName: 'Flow', lastName: 'Test', mobileNumber: '+639171234567', preferredLanguageCode: languageCode }, 201);
      assert.equal((await data('get', '/auth/me', undefined, 200)).operator.id, operator.id);
      const farm = await data('post', '/farms', { ...address, operatorId: operator.id, name: 'Rollback flow farm' }, 201);
      const pond = await data('post', '/ponds', { farmId: farm.id, name: 'Rollback flow pond', areaM2: 1000, waterType: 'freshwater' }, 201);
      const cycle = await data('post', '/stocking-cycles', { pondId: pond.id, speciesId: fish.id, quantityStocked: 2000, stockingDate: '2026-09-24' }, 201);
      assert.equal(Number(cycle.stockingDensityPerM2), 2);
      assert.ok((await data('get', '/farms?limit=100', undefined, 200)).some(row => row.id === farm.id));
      assert.ok((await data('get', '/ponds?limit=100', undefined, 200)).some(row => row.id === pond.id));
      assert.ok((await data('get', `/stocking-cycles?pondId=${pond.id}`, undefined, 200)).some(row => row.id === cycle.id));
      assert.equal((await data('get', `/ponds/${pond.id}/readings/latest`, undefined, 200)).status, 'no_sensor');
      throw rollback;
    });
  } catch (error) { if (error !== rollback) throw error; }
  console.log('Live database API save/read flow passed: operator → farm → pond → stocking → dashboard lists. Test records rolled back. Supabase Auth login is not covered.');
} catch {
  console.error('Live save flow failed. Check database connectivity, migrations and API validation. Credentials and row data omitted.');
  process.exitCode = 1;
} finally { await connection.close(); }
