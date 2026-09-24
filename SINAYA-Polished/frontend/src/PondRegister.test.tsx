// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ me: vi.fn(), request: vi.fn() }));
vi.mock('./lib/supabase', () => ({ supabase: {}, api: mock }));
vi.mock('./components/CompanionFish', () => ({ default: () => null }));
import PondRegister from './PondRegister';
const farm = { id: 'farm-1', name: 'Test farm', isActive: true };
const pond = { id: 'pond-1', farmId: 'farm-1', name: 'Pond A', areaM2: '1000', waterType: 'freshwater', isActive: true, latitude: null, longitude: null };
beforeEach(() => {
  vi.resetAllMocks(); sessionStorage.clear();
  mock.me.mockResolvedValue({ data: { operator: { id: 'operator-1', accountStatus: 'active' } } });
  mock.request.mockImplementation(async (path: string) => {
    if (path.startsWith('/equipment?')) return { data: [{ id: 'tool-1', name: 'Aerator' }] };
    if (path.includes('/equipment?')) return { data: [] };
    if (path.startsWith('/farms?')) return { data: [farm] };
    if (path.startsWith('/species?')) return { data: [{ id: 'species-1', name: 'Tilapia' }] };
    if (path === '/ponds' || path === '/ponds/pond-1') return { data: pond };
    if (path.startsWith('/stocking-cycles?') || path.includes('/sensors?')) return { data: [] };
    if (path === '/stocking-cycles') return { data: { id: 'cycle-1', stockingDensityPerM2: '2', quantityStocked: 2000 } };
    return { data: { id: 'sensor-1' } };
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('preserves PSGC selections on Back and saves address names with a new farm', async () => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: true, json: async () => ({ data: url.endsWith('/regions') ? [{ code: '11', name: 'Davao' }] : url.includes('/regions/11/') ? [{ code: 'city', name: 'Davao City', province: 'Davao del Sur' }] : [{ code: 'b', name: 'Test barangay' }] }) })));
  const original = mock.request.getMockImplementation()!;
  mock.request.mockImplementation(async (path: string, ...args: unknown[]) => path === '/farms' ? { data: farm } : original(path, ...args));
  render(<PondRegister />);
  fireEvent.change(await screen.findByLabelText('Farm'), { target: { value: 'new' } });
  fireEvent.change(screen.getByLabelText('Farm name'), { target: { value: 'New farm' } });
  for (const [label, value] of [['Region', 'Davao'], ['Province', 'Davao del Sur'], ['City / Municipality', 'Davao City'], ['Barangay', 'Test barangay']]) {
    await waitFor(() => expect(Array.from((screen.getByLabelText(label!) as HTMLSelectElement).options).some(option => option.value === value)).toBe(true));
    fireEvent.change(screen.getByLabelText(label!), { target: { value } });
  }
  fireEvent.click(screen.getByRole('button', { name: 'Continue to pond →' }));
  fireEvent.click(await screen.findByRole('button', { name: '← Back' }));
  await waitFor(() => expect((screen.getByLabelText('Barangay') as HTMLSelectElement).value).toBe('Test barangay'));
  fireEvent.click(screen.getByRole('button', { name: 'Continue to pond →' }));
  fireEvent.change(await screen.findByLabelText('Pond name'), { target: { value: 'Pond A' } });
  fireEvent.change(screen.getByLabelText('Pond area (m²)'), { target: { value: '1000' } });
  fireEvent.change(screen.getByLabelText('Water type'), { target: { value: 'freshwater' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continue to stocking →' }));
  fireEvent.change(await screen.findByLabelText('Species'), { target: { value: 'species-1' } });
  fireEvent.change(screen.getByLabelText('Quantity stocked'), { target: { value: '2000' } });
  fireEvent.change(screen.getByLabelText('Stocking date'), { target: { value: '2026-09-24' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continue to sensor →' }));
  await waitFor(() => expect((screen.getByRole('button', { name: 'Save pond · set up sensor later' }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole('button', { name: 'Save pond · set up sensor later' }));
  await screen.findByRole('heading', { name: 'Your pond is registered.' });
  expect(mock.request).toHaveBeenCalledWith('/farms', { method: 'POST', body: { name: 'New farm', region: 'Davao', province: 'Davao del Sur', municipalityCity: 'Davao City', barangay: 'Test barangay', operatorId: 'operator-1', notifyOperator: true } });
});
it('preserves drafts when going back and saves the corrected pond only once', async () => {
  await savePond();
  fireEvent.change(screen.getByLabelText('Species'), { target: { value: 'species-1' } });
  fireEvent.change(screen.getByLabelText('Quantity stocked'), { target: { value: '2000' } });
  fireEvent.change(screen.getByLabelText('Stocking date'), { target: { value: '2026-09-24' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continue to sensor →' }));
  fireEvent.change(await screen.findByLabelText('Sensor serial number'), { target: { value: 'KEEP-THIS' } });
  fireEvent.click(screen.getByRole('button', { name: '← Back' }));
  expect((await screen.findByLabelText('Species') as HTMLSelectElement).value).toBe('species-1');
  fireEvent.click(screen.getByRole('button', { name: '← Back' }));
  const name = await screen.findByLabelText('Pond name');
  expect((name as HTMLInputElement).value).toBe('Pond A');
  fireEvent.change(name, { target: { value: 'Corrected pond' } });
  fireEvent.change(screen.getByLabelText('Pond area (m²)'), { target: { value: '2000' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continue to stocking →' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Continue to sensor →' }));
  expect((await screen.findByLabelText('Sensor serial number') as HTMLInputElement).value).toBe('KEEP-THIS');
  fireEvent.click(screen.getByRole('button', { name: 'Save pond & link sensor →' }));
  await screen.findByRole('heading', { name: 'Your pond is registered.' });
  const writes = mock.request.mock.calls.filter(([path, options]) => path === '/ponds' && options?.method === 'POST');
  expect(writes).toHaveLength(1);
  expect(writes[0]?.[1].body).toMatchObject({ name: 'Corrected pond', areaM2: 2000 });
});
async function savePond() {
  render(<PondRegister />);
  fireEvent.click(await screen.findByRole('button', { name: 'Continue to pond →' }));
  const name = await screen.findByLabelText('Pond name');
  fireEvent.change(name, { target: { value: 'Pond A' } });
  fireEvent.change(screen.getByLabelText('Pond area (m²)'), { target: { value: '1000' } });
  fireEvent.change(screen.getByLabelText('Water type'), { target: { value: 'freshwater' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continue to stocking →' }));
  await screen.findByLabelText('Species');
}
it('saves database-aligned pond and stocking data, allowing sensor setup later', async () => {
  await savePond();
  expect(mock.request.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false);
  fireEvent.change(screen.getByLabelText('Species'), { target: { value: 'species-1' } });
  fireEvent.change(screen.getByLabelText('Quantity stocked'), { target: { value: '2000' } });
  fireEvent.change(screen.getByLabelText('Stocking date'), { target: { value: '2026-09-24' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continue to sensor →' }));
  fireEvent.click(await screen.findByLabelText('Aerator'));
  fireEvent.change(screen.getByLabelText('Aerator quantity'), { target: { value: '2' } });
  await waitFor(() => expect((screen.getByRole('button', { name: 'Save pond · set up sensor later' }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole('button', { name: 'Save pond · set up sensor later' }));
  await screen.findByRole('heading', { name: 'Your pond is registered.' });
  expect(mock.request).toHaveBeenCalledWith('/stocking-cycles', { method: 'POST', body: { pondId: 'pond-1', speciesId: 'species-1', quantityStocked: 2000, stockingDate: '2026-09-24' } });
  expect(screen.getByText('Awaiting installation')).toBeTruthy();
  expect(mock.request).toHaveBeenCalledWith('/farmers/operator-1/equipment', { method: 'POST', body: { equipmentId: 'tool-1', quantity: 2 } });
  await waitFor(() => expect(sessionStorage.getItem('sinaya.pond-setup.operator-1')).toBeNull());
});
it('resumes a saved pond after reload without creating another pond', async () => {
  sessionStorage.setItem('sinaya.pond-setup.operator-1', 'pond-1');
  render(<PondRegister />);
  await screen.findByLabelText('Species');
  expect(mock.request.mock.calls.some(([path, options]) => path === '/ponds' && options?.method === 'POST')).toBe(false);
});
it('gates setup when the operator profile is missing', async () => {
  mock.me.mockResolvedValue({ data: { operator: null } });
  render(<PondRegister />);
  expect((await screen.findByRole('alert')).textContent).toContain('Complete your operator profile');
  expect(mock.request).not.toHaveBeenCalled();
});
it('keeps the saved pond when stocking save fails', async () => {
  await savePond();
  const original = mock.request.getMockImplementation()!;
  mock.request.mockImplementation(async (path: string, ...args: unknown[]) => { if (path === '/stocking-cycles') throw new Error('Temporary failure'); return original(path, ...args); });
  fireEvent.change(screen.getByLabelText('Species'), { target: { value: 'species-1' } });
  fireEvent.change(screen.getByLabelText('Quantity stocked'), { target: { value: '2000' } });
  fireEvent.change(screen.getByLabelText('Stocking date'), { target: { value: '2026-09-24' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continue to sensor →' }));
  await waitFor(() => expect((screen.getByRole('button', { name: 'Save pond · set up sensor later' }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole('button', { name: 'Save pond · set up sensor later' }));
  expect((await screen.findByRole('alert')).textContent).toContain('Earlier records are saved');
  expect(sessionStorage.getItem('sinaya.pond-setup.operator-1')).toBe('pond-1');
});

