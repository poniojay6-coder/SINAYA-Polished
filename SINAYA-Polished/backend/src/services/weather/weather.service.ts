import { eq } from 'drizzle-orm';
import { ponds } from '../../db/schema';
import type { Database } from '../../types/database';
import { HttpError, required } from '../../utils/httpError';
import { DAILY, type Forecast, type WeatherProvider } from './openMeteo.provider';

type Entry = { data: Forecast | null; fetchedAt: number; retryAt: number; failed: boolean };
export function weatherService(db: Database, provider: WeatherProvider, now = Date.now) {
  const cache = new Map<string, Entry>();
  const pending = new Map<string, Promise<Entry>>();
  async function get(latitude: number, longitude: number) {
    const key = `${latitude},${longitude}`;
    const previous = cache.get(key);
    if (previous && previous.retryAt > now()) return previous;
    if (pending.has(key)) return pending.get(key)!;
    const task = (async () => {
      let entry: Entry;
      try { entry = { data: await provider.forecast(latitude, longitude), fetchedAt: now(), retryAt: now() + 900000, failed: false }; }
      catch { entry = { data: previous?.data ?? null, fetchedAt: previous?.fetchedAt ?? 0, retryAt: now() + 60000, failed: true }; }
      if (cache.size >= 100) cache.delete(cache.keys().next().value!);
      cache.set(key, entry);
      return entry;
    })();
    pending.set(key, task);
    try { return await task; } finally { pending.delete(key); }
  }
  return {
    async forPond(pondId: string) {
      const pond = required((await db.select().from(ponds).where(eq(ponds.id, pondId)))[0], 'Pond');
      if (pond.latitude === null || pond.longitude === null) throw new HttpError(422, 'POND_COORDINATES_REQUIRED', 'Set the pond latitude and longitude before requesting weather.');
      const latitude = Number(pond.latitude), longitude = Number(pond.longitude);
      const entry = await get(latitude, longitude);
      const checkedAt = now();
      const base = { pondId, provider: 'Open-Meteo', attributionUrl: 'https://open-meteo.com/', coordinates: { latitude, longitude }, timezone: 'UTC', checkedAt: new Date(checkedAt).toISOString() };
      if (!entry.data || checkedAt - entry.fetchedAt >= 3600000) return { ...base, status: 'unavailable', forecast: null };
      const data = entry.data;
      const start = Math.floor(checkedAt / 3600000) * 3600;
      const indexes = data.hourly.time.map((t, i) => t !== null && t >= start && t < start + 48 * 3600 ? i : -1).filter(i => i >= 0);
      const metric = (key: string, op: 'max' | 'min' | 'sum') => {
        const numbers = indexes.map(i => data.hourly[key][i]).filter((v): v is number => v !== null);
        return { value: numbers.length === 0 ? null : op === 'sum' ? numbers.reduce((a,b) => a+b, 0) : op === 'max' ? Math.max(...numbers) : Math.min(...numbers), samples: numbers.length };
      };
      if (!indexes.length) return { ...base, status: 'unavailable', forecast: null };
      return { ...base, status: entry.failed ? 'stale' : 'available', fetchedAt: new Date(entry.fetchedAt).toISOString(),
        forecast: { gridCoordinates: { latitude: data.latitude, longitude: data.longitude },
          current: data.current, currentUnits: data.current_units,
          next48Hours: { from: new Date(start * 1000).toISOString(), to: new Date((start + 48 * 3600) * 1000).toISOString(), expectedSamples: 48, availableSamples: indexes.length,
            airTemperatureMinC: metric('temperature_2m', 'min'), airTemperatureMaxC: metric('temperature_2m', 'max'),
            rainTotalMm: metric('rain', 'sum'), precipitationProbabilityMaxPercent: metric('precipitation_probability', 'max'),
            windSpeedMaxKmh: metric('wind_speed_10m', 'max'), windGustMaxKmh: metric('wind_gusts_10m', 'max') },
          daily: data.daily.time.map((t, i) => ({ date: new Date(t! * 1000).toISOString().slice(0,10), ...Object.fromEntries(DAILY.map(key => [key, data.daily[key][i]])) })), dailyUnits: data.daily_units,
        } };
    },
  };
}
