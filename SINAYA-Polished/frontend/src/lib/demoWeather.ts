// Public forecasts remain live even when farm records are stored locally.
export async function demoWeather(latitude: unknown, longitude: unknown) {
  const unavailable = { status: 'unavailable', forecast: null };
  if (latitude == null || longitude == null || latitude === '' || longitude === '') return unavailable;
  const lat = Number(latitude), lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return unavailable;
  try {
    const params = new URLSearchParams({ latitude: String(lat), longitude: String(lon), hourly: 'rain,temperature_2m,wind_gusts_10m', forecast_days: '3', timezone: 'UTC', timeformat: 'unixtime', temperature_unit: 'celsius', wind_speed_unit: 'kmh', precipitation_unit: 'mm' });
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return unavailable;
    const result = await response.json();
    const hourly = result.hourly;
    const units = result.hourly_units;
    if (units?.time !== 'unixtime' || units.rain !== 'mm' || units.temperature_2m !== '°C' || units.wind_gusts_10m !== 'km/h') return unavailable;
    const times: unknown[] = hourly?.time;
    if (!Array.isArray(times) || !times.length || times.some((time, i) => typeof time !== 'number' || !Number.isFinite(time) || (i > 0 && time <= Number(times[i - 1])))) return unavailable;
    const keys = ['rain', 'temperature_2m', 'wind_gusts_10m'];
    if (keys.some(key => !Array.isArray(hourly[key]) || hourly[key].length !== times.length || hourly[key].some((v: unknown) => v !== null && (typeof v !== 'number' || !Number.isFinite(v))))) return unavailable;
    const start = Math.floor(Date.now() / 3600000) * 3600;
    const indices = times.flatMap((time, i) => Number(time) >= start && Number(time) < start + 48 * 3600 ? [i] : []);
    if (!indices.length) return unavailable;
    function metric(key: string, sum = false) {
      const values = indices.map(i => hourly[key][i]).filter((v): v is number => typeof v === 'number');
      return { value: values.length ? sum ? values.reduce((a, b) => a + b, 0) : Math.max(...values) : null, samples: values.length };
    }
    return { status: 'available', fetchedAt: new Date().toISOString(), forecast: { next48Hours: { availableSamples: indices.length, expectedSamples: 48, rainTotalMm: metric('rain', true), airTemperatureMaxC: metric('temperature_2m'), windGustMaxKmh: metric('wind_gusts_10m') } } };
  } catch { return unavailable; }
}
