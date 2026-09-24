import { afterEach, expect, it, vi } from 'vitest';
import { demoWeather } from './demoWeather';
afterEach(() => vi.unstubAllGlobals());
it('requests the pond location and aggregates the next 48 hours, preserving missing samples', async () => {
  const start = Math.floor(Date.now() / 3600000) * 3600;
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ hourly_units: { time: 'unixtime', rain: 'mm', temperature_2m: '°C', wind_gusts_10m: 'km/h' }, hourly: { time: Array.from({ length: 72 }, (_, i) => start + i * 3600), rain: Array(72).fill(1), temperature_2m: [null, ...Array(71).fill(30)], wind_gusts_10m: Array(72).fill(12) } }) });
  vi.stubGlobal('fetch', fetcher);
  const result = await demoWeather('7.07', '125.6');
  const url = new URL(fetcher.mock.calls[0]![0]);
  expect(url.searchParams.get('latitude')).toBe('7.07');
  expect(url.searchParams.get('longitude')).toBe('125.6');
  expect(result.status).toBe('available');
  expect(result.forecast?.next48Hours.rainTotalMm).toEqual({ value: 48, samples: 48 });
  expect(result.forecast?.next48Hours.airTemperatureMaxC).toEqual({ value: 30, samples: 47 });
});
it('does not request a forecast without valid coordinates', async () => {
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  expect((await demoWeather(null, null)).status).toBe('unavailable');
  expect((await demoWeather(91, 125)).status).toBe('unavailable');
  expect(fetcher).not.toHaveBeenCalled();
});
it('shows unavailable on network failure instead of inventing weather', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  expect(await demoWeather(7, 125)).toEqual({ status: 'unavailable', forecast: null });
});
