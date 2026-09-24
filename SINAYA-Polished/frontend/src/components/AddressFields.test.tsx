// @vitest-environment jsdom
import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import AddressFields from './AddressFields';
import type { Address } from './AddressFields';
const empty = { region: '', province: '', municipalityCity: '', barangay: '' };
function Form({ initial = empty }: { initial?: Address }) {
  const [address, setAddress] = useState(initial);
  return <form><AddressFields value={address} onChange={setAddress} /><output>{JSON.stringify(address)}</output></form>;
}
function mockDirectory() {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: true, json: async () => ({ data: url.endsWith('/regions') ? [{ code: '11', name: 'Davao' }, { code: '13', name: 'NCR' }] : url.includes('regions/11/') ? [{ code: 'city1', name: 'Davao City', province: 'Davao del Sur' }] : url.includes('regions/13/') ? [{ code: 'city2', name: 'Manila', province: null }] : [{ code: 'b1', name: 'Barangay One' }] }) })));
}
async function choose(label: string, value: string) {
  await waitFor(() => expect(Array.from((screen.getByLabelText(label) as HTMLSelectElement).options).some(option => option.value === value)).toBe(true));
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('loads dependent lists, saves names and clears children when region changes', async () => {
  mockDirectory(); render(<Form />);
  await choose('Region', 'Davao'); await choose('Province', 'Davao del Sur'); await choose('City / Municipality', 'Davao City'); await choose('Barangay', 'Barangay One');
  expect(new FormData(screen.getByLabelText('Region').closest('form')!).get('barangay')).toBe('Barangay One');
  await choose('Region', 'NCR');
  expect((screen.getByLabelText('Barangay') as HTMLSelectElement).value).toBe('');
  await choose('Province', 'Not applicable'); await choose('City / Municipality', 'Manila'); await choose('Barangay', 'Barangay One');
  expect(screen.getByRole('status').textContent).toContain('Not applicable');
});
it('restores a saved address after each directory loads', async () => {
  mockDirectory(); render(<Form initial={{ region: 'Davao', province: 'Davao del Sur', municipalityCity: 'Davao City', barangay: 'Barangay One' }} />);
  await waitFor(() => expect((screen.getByLabelText('Barangay') as HTMLSelectElement).value).toBe('Barangay One'));
});
it('allows retry after an API failure', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline'))); render(<Form />);
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('Unable to load'));
  mockDirectory(); fireEvent.click(screen.getByRole('button', { name: 'Retry addresses' }));
  await choose('Region', 'NCR');
  expect(screen.queryByRole('alert')).toBeNull();
});
