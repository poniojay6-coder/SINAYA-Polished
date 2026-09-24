import test from 'node:test';
import assert from 'node:assert/strict';
import { OpenMeteoProvider, CURRENT, HOURLY, DAILY } from '../dist/services/weather/openMeteo.provider.js';
import { weatherService } from '../dist/services/weather/weather.service.js';

const start = Date.parse('2026-09-23T08:00:00Z');
function forecast() {
  const units = { temperature_2m: '°C', apparent_temperature_min: '°C', apparent_temperature_max: '°C', rain: 'mm', precipitation: 'mm', rain_sum: 'mm', wind_speed_10m: 'km/h', wind_gusts_10m: 'km/h', wind_speed_10m_max: 'km/h', wind_gusts_10m_max: 'km/h', wind_direction_10m: '°', precipitation_probability: '%', precipitation_probability_max: '%', weather_code: 'wmo code' };
  const u = keys => ({time:'unixtime',...Object.fromEntries(keys.map(k=>[k,units[k]]))});
  return { latitude:7.1, longitude:125.6, utc_offset_seconds:0,
    current:{time:start/1000,...Object.fromEntries(CURRENT.map(k=>[k,1]))},
    hourly:{time:Array.from({length:72},(_,i)=>start/1000+i*3600),...Object.fromEntries(HOURLY.map(k=>[k,Array(72).fill(1)]))},
    daily:{time:[0,1,2].map(i=>start/1000+i*86400),...Object.fromEntries(DAILY.map(k=>[k,[1,2,3]]))},
    current_units:u(CURRENT),hourly_units:u(HOURLY),daily_units:u(DAILY)};
}
test('provider uses supplied coordinates, explicit units, horizons and rejects malformed upstream data', async()=>{
  let requested;
  const provider = new OpenMeteoProvider(async url=>{requested=url;return new Response(JSON.stringify(forecast()));});
  await provider.forecast(7.1,125.6);
  assert.equal(requested.searchParams.get('latitude'),'7.1');
  assert.equal(requested.searchParams.get('forecast_days'),'3');
  assert.equal(requested.searchParams.get('timezone'),'UTC');
  for(const mutate of [f=>f.hourly.rain.pop(),f=>f.current_units.rain='inch',f=>f.daily.time=[null],f=>f.current.temperature_2m='hot']) {
    const f=forecast();mutate(f);
    await assert.rejects(()=>new OpenMeteoProvider(async()=>new Response(JSON.stringify(f))).forecast(0,0));
  }
  await assert.rejects(()=>new OpenMeteoProvider(async()=>new Response('{}',{status:429})).forecast(0,0));
});
test('service coalesces requests, caches, preserves nulls and expires stale fallbacks',async()=>{
  let clock=start,calls=0,fail=false;
  const f=forecast();f.hourly.rain.fill(null);
  const db={select:()=>({from:()=>({where:async()=>[{latitude:'7.1',longitude:'125.6'}]})})};
  const service=weatherService(db,{forecast:async()=>{calls++;if(fail)throw Error('private upstream error');return f;}},()=>clock);
  const [a,b]=await Promise.all([service.forPond('one'),service.forPond('two')]);
  assert.equal(calls,1);assert.equal(a.status,'available');assert.equal(b.pondId,'two');
  assert.equal(a.forecast.next48Hours.rainTotalMm.value,null);
  assert.equal(a.forecast.next48Hours.availableSamples,48);
  assert.equal('hourly' in a.forecast,false);
  await service.forPond('one');assert.equal(calls,1);
  fail=true;clock+=16*60000;
  assert.equal((await service.forPond('one')).status,'stale');assert.equal(calls,2);
  await service.forPond('one');assert.equal(calls,2);
  clock+=60*60000;
  const unavailable=await service.forPond('one');assert.equal(unavailable.status,'unavailable');assert.equal(unavailable.forecast,null);
  assert.equal(JSON.stringify(unavailable).includes('private'),false);
  const noCoords={select:()=>({from:()=>({where:async()=>[{latitude:null,longitude:null}]})})};
  await assert.rejects(()=>weatherService(noCoords,{}).forPond('one'),e=>e.code==='POND_COORDINATES_REQUIRED');
});
