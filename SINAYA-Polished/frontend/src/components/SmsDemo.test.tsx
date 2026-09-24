// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import SmsDemo from './SmsDemo';
vi.mock('../lib/supabase', () => ({ api: { me: async () => ({ data: { operator: null } }) } }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it.each(['Low oxygen', 'Unusual pH', 'High water temperature', 'Heavy rain', 'Disconnected sensor'])('previews and records %s without network traffic or duplicate clicks', (scenario) => {
  const network = vi.spyOn(globalThis, 'fetch');
  render(<SmsDemo pondName="Pond A" />);
  fireEvent.click(screen.getByRole('button', { name: scenario }));
  const send = screen.getByRole('button', { name: 'Simulate SMS delivery' });
  expect((send as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Run scenario' }));
  expect(screen.getByText(/SINAYA DEMO — SIMULATED DATA/).textContent).toContain('Pond A');
  fireEvent.click(send); fireEvent.click(send);
  expect(screen.getAllByText(new RegExp(`${scenario} · Simulated delivery`))).toHaveLength(1);
  expect(network).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Clear demo log' }));
  expect(screen.getByText('No simulated deliveries yet.')).toBeTruthy();
});
it('does not queue normal readings and resets the preview when switching scenarios', () => {
  render(<SmsDemo pondName="Pond A" />);
  fireEvent.click(screen.getByRole('button', { name: 'Normal readings' }));
  fireEvent.click(screen.getByRole('button', { name: 'Run scenario' }));
  expect(screen.getByText('No alert for this scripted scenario. No SMS is queued.')).toBeTruthy();
  expect((screen.getByRole('button', { name: 'Simulate SMS delivery' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Low oxygen' }));
  expect(screen.getByText('Run a scenario to preview its message.')).toBeTruthy();
});
