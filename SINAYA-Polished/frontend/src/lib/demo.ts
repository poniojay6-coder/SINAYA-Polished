import type { ApiResponse } from './api';
import { demoWeather } from './demoWeather';
export const demoMode = import.meta.env.MODE !== 'test' && import.meta.env.VITE_DEMO_MODE === 'true';
type Row = Record<string, unknown> & { id: string };
type Store = { farms: Row[]; ponds: Row[]; cycles: Row[]; sensors: Row[]; equipment?: Row[] };
const key = 'sinaya.local-demo.v1';
export const demoOperator = { id: 'demo-operator', firstName: 'Demo', lastName: 'Operator', preferredLanguageCode: 'en', smsConsent: false, accountStatus: 'active' };
export async function demoRequest<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<ApiResponse<T>> {
  const store: Store = JSON.parse(localStorage.getItem(key) ?? '{"farms":[],"ponds":[],"cycles":[],"sensors":[]}');
  const url = new URL(path, 'http://demo.local');
  const parts = url.pathname.split('/').filter(Boolean);
  let data: unknown;
  if (parts[0] === 'auth') data = { userId: 'demo-user', operator: demoOperator };
  else if (parts[0] === 'languages') data = [{ code: 'en', name: 'English', nativeName: 'English' }, { code: 'fil', name: 'Filipino', nativeName: 'Filipino' }, { code: 'ceb', name: 'Cebuano', nativeName: 'Cebuano' }];
  else if (parts[0] === 'equipment') data = ['Aerator', 'Water pump', 'Backup generator', 'Water testing kit'].map(name => ({ id: name.toLowerCase().replaceAll(' ', '-'), name }));
  else if (parts[0] === 'farmers' && parts[2] === 'equipment') {
    const rows = store.equipment ?? [];
    if (options.method === 'POST') {
      const body = options.body as Record<string, unknown>;
      if (rows.some(item => item.equipmentId === body.equipmentId)) throw new Error('Equipment already saved.');
      const row = { ...body, id: crypto.randomUUID(), farmerId: parts[1] };
      store.equipment = [...rows, row]; localStorage.setItem(key, JSON.stringify(store)); data = row;
    } else { const offset = Number(url.searchParams.get('offset') ?? 0); data = rows.slice(offset, offset + Number(url.searchParams.get('limit') ?? 100)); }
  }
  else if (parts[0] === 'species') data = ['Tilapia', 'Bangus', 'Shrimp'].map(name => ({ id: name.toLowerCase(), name }));
  else if (parts[0] === 'farmers' && options.method === 'POST') data = { ...demoOperator, ...(options.body as object) };
  else if (parts[0] === 'ponds' && parts[2] === 'equipment') {
    const pond = store.ponds.find(item => item.id === parts[1]);
    if (!pond) throw new Error('Pond not found in this demo.');
    if (options.method === 'PATCH') {
      const selections = (options.body as { tools: { equipmentId: string; quantity: number }[] }).tools;
      if (!Array.isArray(selections) || selections.some(item => !item.equipmentId || !Number.isInteger(item.quantity) || item.quantity < 1)) throw new Error('Invalid pond equipment.');
      pond.tools = selections;
      localStorage.setItem(key, JSON.stringify(store));
    }
    data = pond.tools ?? [];
  }
  else if (parts[0] === 'ponds' && parts[2] === 'readings') data = parts[3] === 'latest'
    ? { status: store.sensors.some(item => item.pondId === parts[1] && item.isActive) ? 'missing' : 'no_sensor', reading: null }
    : [];
  else if (parts[0] === 'ponds' && parts[2] === 'assessments') data = [];
  else if (parts[0] === 'ponds' && parts[2] === 'weather') {
    const pond = store.ponds.find(item => item.id === parts[1]);
    if (!pond) throw new Error('Pond not found in this demo.');
    data = await demoWeather(pond.latitude, pond.longitude);
  }
  else {
    const table = parts[2] === 'sensors' ? 'sensors' : parts[0] === 'stocking-cycles' ? 'cycles' : parts[0];
    if (!['farms', 'ponds', 'cycles', 'sensors'].includes(table!)) throw new Error('This action is not available in local demo mode.');
    const rows = store[table as keyof Store] ?? [];
    if (options.method === 'POST') {
      const body = options.body as Record<string, unknown>;
      const row: Row = { ...body, id: crypto.randomUUID(), isActive: true, latitude: null, longitude: null };
      Object.assign(row, body);
      if (table === 'sensors') {
        row.pondId = parts[1];
        if (rows.some(item => item.serialNumber === row.serialNumber || item.pondId === row.pondId)) throw new Error('Sensor serial or pond already has an active assignment.');
      }
      if (table === 'cycles') {
        const pond = store.ponds.find(item => item.id === body.pondId);
        if (!pond) throw new Error('Pond not found in this demo.');
        row.stockedAreaM2 = pond.areaM2;
        row.stockingDensityPerM2 = String(Number(body.quantityStocked) / Number(pond.areaM2));
        row.status = 'active';
      }
      rows.push(row);
      localStorage.setItem(key, JSON.stringify(store));
      data = row;
    } else if (options.method === 'PATCH' && parts[1] && ['farms', 'ponds'].includes(table!)) {
      const row = rows.find(item => item.id === parts[1]);
      if (!row) throw new Error('Record not found in this demo.');
      const body = options.body as Record<string, unknown>;
      if (table === 'farms' && body.isActive === false && store.ponds.some(pond => pond.farmId === row.id && pond.isActive !== false)) throw new Error('Remove the farm’s ponds first.');
      const allowed = table === 'farms' ? ['name', 'region', 'province', 'municipalityCity', 'barangay', 'isActive'] : ['name', 'areaM2', 'waterType', 'latitude', 'longitude', 'isActive'];
      for (const field of allowed) if (field in body) row[field] = body[field];
      localStorage.setItem(key, JSON.stringify(store)); data = row;
    } else if (parts[1] && table !== 'sensors') {
      data = rows.find(item => item.id === parts[1]);
      if (!data) throw new Error('Record not found in this demo.');
    } else {
      const pondId = table === 'sensors' ? parts[1] : url.searchParams.get('pondId');
      const farmId = url.searchParams.get('farmId');
      const filtered = pondId ? rows.filter(item => item.pondId === pondId) : farmId ? rows.filter(item => item.farmId === farmId) : rows;
      const offset = Number(url.searchParams.get('offset') ?? 0);
      data = filtered.slice(offset, offset + Number(url.searchParams.get('limit') ?? 100));
    }
  }
  return { data: data as T };
}

