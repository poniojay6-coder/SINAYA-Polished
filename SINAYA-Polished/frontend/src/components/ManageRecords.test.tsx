// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
const request = vi.hoisted(() => vi.fn());
vi.mock('../lib/supabase', () => ({ api: { request } }));
import ManageRecords from './ManageRecords';
const farms = [{ id: 'f', operatorId: 'o', name: 'Farm', isActive: true }];
const ponds = [{ id: 'p', farmId: 'f', name: 'Pond', areaM2: '100', waterType: 'freshwater', latitude: null, longitude: null, isActive: true }];
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it('requires confirmation, supports cancel, and prevents deleting a farm with ponds', async () => {
  request.mockResolvedValue({ data: {} }); const onSaved = vi.fn();
  render(<ManageRecords farms={farms} ponds={ponds} onSaved={onSaved} />);
  expect((screen.getByRole('button', { name: 'Delete farm' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Delete pond Pond' }));
  expect(request).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(request).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Delete pond Pond' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm deletion' }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  expect(request).toHaveBeenCalledWith('/ponds/p', { method: 'PATCH', body: { isActive: false } });
});
it('saves edited pond details and keeps stocking records out of the update', async () => {
  request.mockResolvedValue({ data: {} }); const onSaved = vi.fn();
  render(<ManageRecords farms={farms} ponds={ponds} onSaved={onSaved} />);
  fireEvent.click(screen.getByRole('button', { name: 'Edit pond Pond' }));
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Updated pond' } });
  fireEvent.change(screen.getByLabelText('Pond area (m²)'), { target: { value: '200' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  expect(request).toHaveBeenCalledWith('/ponds/p', { method: 'PATCH', body: { name: 'Updated pond', areaM2: 200, waterType: 'freshwater', latitude: null, longitude: null } });
});
