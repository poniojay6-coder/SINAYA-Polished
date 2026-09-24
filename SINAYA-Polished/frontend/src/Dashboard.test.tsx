// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ me: vi.fn(), request: vi.fn() }));
vi.mock('./lib/supabase', () => ({ api: mock }));
vi.mock('./lib/demo', () => ({ demoMode: true }));
vi.mock('./components/CompanionFish', () => ({ default: () => null }));
import Dashboard from './Dashboard';
beforeEach(() => {
  vi.resetAllMocks();
  mock.me.mockResolvedValue({ data: { operator: { id: 'operator-1', firstName: 'Test', accountStatus: 'active' } } });
  mock.request.mockImplementation(async (path: string) => {
    if (path.startsWith('/farms?')) return { data: [{ id: 'farm-1', name: 'Test farm' }] };
    if (path.startsWith('/ponds?')) return { data: [{ id: 'pond-1', farmId: 'farm-1', name: 'Tilapia pond', areaM2: '1000', waterType: 'freshwater', isActive: true, latitude: null, longitude: null }] };
    if (path.includes('/readings/latest')) return { data: { status: 'missing', reading: null } };
    return { data: [] };
  });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });
it('shows saved ponds without inventing readings and allows explicitly labeled synthetic charts', async () => {
  render(<Dashboard />);
  await screen.findByRole('button', { name: /Test farm.*Tilapia pond/ });
  expect(screen.getAllByText('Awaiting readings').length).toBeGreaterThan(0);
  const preview = await screen.findByRole('button', { name: 'Preview sample readings' });
  await waitFor(() => expect(screen.queryByText('Loading history…')).toBeNull());
  fireEvent.click(preview);
  expect(await screen.findByRole('img', { name: /Dissolved oxygen trend/ })).toBeTruthy();
  expect(screen.getByText(/Synthetic sample readings for design preview only/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Hide samples' }));
  expect(screen.queryByRole('img', { name: /Dissolved oxygen trend/ })).toBeNull();
});
it('updates demo readings on a timer and stops when hidden', async () => {
  render(<Dashboard />);
  const preview = await screen.findByRole('button', { name: 'Preview sample readings' });
  await waitFor(() => expect(screen.queryByText('Loading history…')).toBeNull());
  vi.useFakeTimers();
  fireEvent.click(preview);
  const points = () => screen.getByRole('img', { name: /Dissolved oxygen trend/ }).querySelector('polyline')!.getAttribute('points');
  const before = points();
  act(() => { vi.advanceTimersByTime(5000); });
  expect(points()).not.toBe(before);
  fireEvent.click(screen.getByRole('button', { name: 'Hide samples' }));
  act(() => { vi.advanceTimersByTime(5000); });
  expect(screen.queryByRole('img', { name: /Dissolved oxygen trend/ })).toBeNull();
  expect(mock.request.mock.calls.every(call => call[1]?.method !== 'POST')).toBe(true);
});
it('filters ponds and explains no matches', async () => {
  render(<Dashboard />);
  fireEvent.change(await screen.findByLabelText('Find a pond'), { target: { value: 'nonexistent' } });
  expect(screen.getByText('No matching ponds.')).toBeTruthy();
});
it('retains a pond view when its reading endpoint fails', async () => {
  const original = mock.request.getMockImplementation()!;
  mock.request.mockImplementation(async (path: string) => { if (path.includes('/readings/latest')) throw new Error('offline'); return original(path); });
  render(<Dashboard />);
  await screen.findByRole('button', { name: /Test farm.*Tilapia pond/ });
  expect(screen.getAllByText('Readings unavailable').length).toBeGreaterThan(0);
});
it('offers a useful empty state before the first pond is created', async () => {
  mock.request.mockResolvedValue({ data: [] });
  render(<Dashboard />);
  expect(await screen.findByRole('link', { name: 'Register your first pond →' })).toBeTruthy();
});
