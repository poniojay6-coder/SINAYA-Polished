import { z } from "zod";

export const CURRENT = ['temperature_2m', 'precipitation', 'rain'] as const;
export const HOURLY = ['wind_speed_10m', 'wind_gusts_10m', 'wind_direction_10m', 'weather_code', 'temperature_2m', 'rain', 'precipitation_probability'] as const;
export const DAILY = ['apparent_temperature_min', 'apparent_temperature_max', 'precipitation_probability_max', 'rain_sum', 'weather_code', 'wind_gusts_10m_max', 'wind_speed_10m_max'] as const;
const values = z.record(z.string(), z.number().finite().nullable());
const series = z.record(z.string(), z.array(z.number().finite().nullable()));
const responseSchema = z.object({
  latitude: z.number().finite(), longitude: z.number().finite(), utc_offset_seconds: z.literal(0),
  current: values, hourly: series, daily: series,
  current_units: z.record(z.string(), z.string()), hourly_units: z.record(z.string(), z.string()), daily_units: z.record(z.string(), z.string()),
});
export type Forecast = z.output<typeof responseSchema>;
export interface WeatherProvider { forecast(latitude: number, longitude: number): Promise<Forecast> }
export class OpenMeteoProvider implements WeatherProvider {
  constructor(private readonly fetcher: typeof fetch = fetch) {}
  async forecast(latitude: number, longitude: number): Promise<Forecast> {
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.search = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude),
      current: CURRENT.join(','), hourly: HOURLY.join(','), daily: DAILY.join(','),
      forecast_days: '3', timezone: 'UTC', timeformat: 'unixtime', temperature_unit: 'celsius', wind_speed_unit: 'kmh', precipitation_unit: 'mm' }).toString();
    const response = await this.fetcher(url, { signal: AbortSignal.timeout(8000), redirect: 'error' });
    if (!response.ok) throw new Error('Weather provider unavailable');
    const result = responseSchema.parse(await response.json());
    for (const [group, keys] of [[result.hourly, HOURLY], [result.daily, DAILY]] as const) {
      const times = group.time;
      if (!times?.length || times.some((t, i) => t === null || (i > 0 && t <= times[i - 1]!))) throw new Error('Invalid weather timeline');
      if (keys.some((key) => !group[key] || group[key].length !== times.length)) throw new Error('Incomplete weather arrays');
    }
    if (result.current.time == null || CURRENT.some((key) => !(key in result.current))) throw new Error('Incomplete current weather');
    const expected: Record<string, string> = { temperature_2m: '°C', apparent_temperature_min: '°C', apparent_temperature_max: '°C', rain: 'mm', precipitation: 'mm', rain_sum: 'mm', wind_speed_10m: 'km/h', wind_gusts_10m: 'km/h', wind_speed_10m_max: 'km/h', wind_gusts_10m_max: 'km/h', wind_direction_10m: '°', precipitation_probability: '%', precipitation_probability_max: '%', weather_code: 'wmo code' };
    for (const [units, keys] of [[result.current_units, CURRENT], [result.hourly_units, HOURLY], [result.daily_units, DAILY]] as const) {
      if (units.time !== 'unixtime' || keys.some((key) => units[key] !== expected[key])) throw new Error('Unexpected weather units');
    }
    return result;
  }
}
