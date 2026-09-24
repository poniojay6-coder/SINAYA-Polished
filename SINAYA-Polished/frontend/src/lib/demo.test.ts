// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { demoRequest } from './demo';
it('keeps equipment separate per pond and never inherits the farmer inventory', async () => {
  localStorage.clear();
  const a = (await demoRequest<{ id: string }>('/ponds', { method: 'POST', body: { name: 'A' } })).data;
  const b = (await demoRequest<{ id: string }>('/ponds', { method: 'POST', body: { name: 'B' } })).data;
  await demoRequest('/farmers/demo-operator/equipment', { method: 'POST', body: { equipmentId: 'aerator', quantity: 2 } });
  expect((await demoRequest(`/ponds/${b.id}/equipment`)).data).toEqual([]);
  await demoRequest(`/ponds/${a.id}/equipment`, { method: 'PATCH', body: { tools: [{ equipmentId: 'aerator', quantity: 1 }] } });
  expect((await demoRequest(`/ponds/${a.id}/equipment`)).data).toEqual([{ equipmentId: 'aerator', quantity: 1 }]);
  expect((await demoRequest(`/ponds/${b.id}/equipment`)).data).toEqual([]);
  localStorage.clear();
});
it('registers and retrieves demo farm, pond, stocking, and sensor without a network request', async () => {
  localStorage.clear();
  const network = vi.spyOn(globalThis, 'fetch');
  const farm = await demoRequest<{ id: string }>('/farms', { method: 'POST', body: { name: 'Demo farm' } });
  const pond = await demoRequest<{ id: string }>('/ponds', { method: 'POST', body: { farmId: farm.data.id, name: 'Demo pond', areaM2: 1000 } });
  const cycle = await demoRequest<{ stockingDensityPerM2: string }>('/stocking-cycles', { method: 'POST', body: { pondId: pond.data.id, quantityStocked: 2000 } });
  expect(cycle.data.stockingDensityPerM2).toBe('2');
  await demoRequest(`/ponds/${pond.data.id}/sensors`, { method: 'POST', body: { serialNumber: 'DEMO-001' } });
  expect((await demoRequest<unknown[]>(`/ponds/${pond.data.id}/sensors`)).data).toHaveLength(1);
  expect((await demoRequest<{ id: string }>(`/ponds/${pond.data.id}`)).data.id).toBe(pond.data.id);
  expect(network).not.toHaveBeenCalled();
  network.mockRestore();
  localStorage.clear();
});
