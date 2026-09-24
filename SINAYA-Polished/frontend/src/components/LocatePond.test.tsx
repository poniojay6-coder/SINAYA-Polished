// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import LocatePond from './LocatePond';
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('fills pond coordinates only after the user requests device location', () => {
  const locate = vi.fn(success => success({ coords: { latitude: 7.07, longitude: 125.6, accuracy: 20 } }));
  vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: locate } });
  render(<form><LocatePond /><label>Latitude<input name="latitude" /></label><label>Longitude<input name="longitude" /></label></form>);
  expect(locate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Use my current location' }));
  expect((screen.getByLabelText('Latitude') as HTMLInputElement).value).toBe('7.070000');
  expect((screen.getByLabelText('Longitude') as HTMLInputElement).value).toBe('125.600000');
  expect(screen.getByRole('status').textContent).toContain('±20 m');
});
it('keeps manual coordinates when location permission is denied', () => {
  vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: (_success: unknown, failure: (e: { code: number }) => void) => failure({ code: 1 }) } });
  render(<form><LocatePond /><input name="latitude" aria-label="Latitude" defaultValue="7" /></form>);
  fireEvent.click(screen.getByRole('button', { name: 'Use my current location' }));
  expect(screen.getByRole('status').textContent).toContain('denied');
  expect((screen.getByLabelText('Latitude') as HTMLInputElement).value).toBe('7');
});
