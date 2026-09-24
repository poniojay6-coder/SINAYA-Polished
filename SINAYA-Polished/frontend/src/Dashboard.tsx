import SiteFooter from './components/SiteFooter';
import SiteHeader from './components/SiteHeader';
import { useEffect, useState } from 'react';
import { api } from './lib/supabase';
import { demoMode } from './lib/demo';
import type { Farm, Pond, Operator, Assessment } from './lib/api';
import CompanionFish from './components/CompanionFish';
import DashboardNav from './components/DashboardNav';
import ManageRecords from './components/ManageRecords';
import SmsDemo from './components/SmsDemo';
import './Register.css';
import './Dashboard.css';

type Reading = { id: string; observedAt: string; dissolvedOxygenMgL: number; ph: number; waterTemperatureC: number; source: string };
// Presentation ranges only; these are not species-specific safety thresholds.
function randomSample(time: number): Reading {
  const between = (min: number, max: number) => Number((min + Math.random() * (max - min)).toFixed(2));
  return { id: `sample-${time}`, source: 'simulated', observedAt: new Date(time).toISOString(), dissolvedOxygenMgL: between(2, 8), ph: between(6, 9.5), waterTemperatureC: between(24, 35) };
}
type Latest = { status: string; reading: Reading | null };
type Cycle = { id: string; pondId: string; speciesId: string; status: string; quantityStocked: number; stockingDensityPerM2: string; stockingDate: string; expectedHarvestDate: string | null };
type Metric = { value: number | null; samples: number };
type Weather = { status: string; fetchedAt?: string; forecast: null | { next48Hours: { availableSamples: number; expectedSamples: number; rainTotalMm: Metric; airTemperatureMaxC: Metric; windGustMaxKmh: Metric } } };
type PondStatus = { latest: Latest | null; assessment: Assessment | null; assessmentFailed: boolean };
const stamp = (date: string) => new Date(date).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const number = (value: number | string | null | undefined, digits = 1) => value == null ? '—' : Number(value).toLocaleString(undefined, { maximumFractionDigits: digits });
const statusLabel = (status?: string) => ({ fresh: 'Recent reading', stale: 'Reading is stale', missing: 'Awaiting readings', no_sensor: 'No sensor linked' })[status ?? ''] ?? 'Readings unavailable';
const assessmentLabel = (status: string) => status.replaceAll('_', ' ');
async function listAll<T>(path: string): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data } = await api.request<T[]>(`${path}?limit=100&offset=${offset}`);
    rows.push(...data); if (data.length < 100) return rows;
  }
}

function ReadingMetrics({ reading }: { reading: Reading | null }) {
  return <div className="reading-metrics">{[['Dissolved oxygen', reading?.dissolvedOxygenMgL, 'mg/L'], ['pH', reading?.ph, 'pH'], ['Water temperature', reading?.waterTemperatureC, '°C']].map(([label, value, unit]) => <div key={String(label)}><span>{label}</span><strong>{number(value as number | undefined)} <small>{unit}</small></strong></div>)}</div>;
}

function ReadingChart({ readings, metric }: { readings: Reading[]; metric: 'dissolvedOxygenMgL' | 'ph' | 'waterTemperatureC' }) {
  if (readings.length < 2) return <div className="chart-empty">At least two readings are needed to show a trend.</div>;
  const ordered = [...readings].sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt));
  const values = ordered.map(item => item[metric]);
  const min = Math.min(...values), max = Math.max(...values);
  const pad = Math.max((max - min) * .2, .2), low = min - pad, high = max + pad;
  const first = Date.parse(ordered[0]!.observedAt), last = Date.parse(ordered.at(-1)!.observedAt);
  const points = ordered.map(item => `${48 + (Date.parse(item.observedAt) - first) / Math.max(last - first, 1) * 600},${160 - (item[metric] - low) / (high - low) * 130}`).join(' ');
  return <div className="trend-chart"><svg viewBox="0 0 680 195" role="img" aria-label={`${metric === 'ph' ? 'pH' : metric === 'dissolvedOxygenMgL' ? 'Dissolved oxygen' : 'Water temperature'} trend from ${stamp(ordered[0]!.observedAt)} to ${stamp(ordered.at(-1)!.observedAt)}`}>
    {[30, 95, 160].map((y, i) => <g key={y}><line x1="48" x2="648" y1={y} y2={y} stroke="currentColor" opacity=".12" /><text x="0" y={y + 4} fill="currentColor" fontSize="11">{number(high - i * (high - low) / 2)}</text></g>)}
    <polyline points={points} fill="none" stroke="#7ae8d4" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
  </svg><div className="chart-range"><span>{stamp(ordered[0]!.observedAt)}</span><span>{stamp(ordered.at(-1)!.observedAt)}</span></div></div>;
}

function PondDetail({ pond, status, cycles, species, farmName, refresh }: { pond: Pond; status?: PondStatus; cycles: Cycle[]; species: Record<string, string>; farmName?: string; refresh: number }) {
  const [history, setHistory] = useState<Reading[]>([]);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [historyFailed, setHistoryFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [samples, setSamples] = useState<Reading[] | null>(null);
  const simulating = samples !== null;
  useEffect(() => {
    if (!simulating) return;
    const timer = setInterval(() => setSamples(previous => {
      if (!previous) return null;
      const now = Date.now();
      return [...previous.slice(-47), randomSample(now)];
    }), 5000);
    return () => clearInterval(timer);
  }, [simulating]);
  const [metric, setMetric] = useState<'dissolvedOxygenMgL' | 'ph' | 'waterTemperatureC'>('dissolvedOxygenMgL');
  useEffect(() => {
    let active = true;
    async function load() {
      const [readings, forecast] = await Promise.allSettled([
        api.request<Reading[]>(`/ponds/${encodeURIComponent(pond.id)}/readings?limit=48&source=device`),
        pond.latitude != null && pond.longitude != null ? api.request<Weather>(`/ponds/${encodeURIComponent(pond.id)}/weather`) : Promise.resolve(null),
      ]);
      if (!active) return;
      setHistory(readings.status === 'fulfilled' ? readings.value.data : []);
      setHistoryFailed(readings.status === 'rejected');
      setWeather(forecast.status === 'fulfilled' ? forecast.value?.data ?? null : null);
      setLoading(false);
    }
    void load(); return () => { active = false; };
  }, [pond.id, pond.latitude, pond.longitude, refresh]);
  const display = samples ?? history;
  const latest = samples?.at(-1) ?? status?.latest?.reading ?? null;
  function preview() {
    const now = Date.now();
    setSamples(Array.from({ length: 12 }, (_, i) => randomSample(now - (11 - i) * 5000)));
  }
  return <section id="dash-readings" tabIndex={-1} className="pond-detail" aria-label={`${pond.name} details`}>
    <div className="dash-section-heading"><div><p className="eyebrow">POND IN FOCUS · {farmName}</p><h2>{pond.name}</h2><p>{number(pond.areaM2)} m² · {pond.waterType} · {pond.isActive ? 'Active pond' : 'Inactive pond'}</p></div><span className="status-pill">{samples ? 'Synthetic preview' : statusLabel(status?.latest?.status)}</span></div>
    {demoMode && <div className="sample-controls"><p>{samples ? 'Synthetic sample readings for design preview only. Updating every 5 seconds. These are not saved and do not trigger alerts.' : 'Your demo pond has no real sensor readings yet. You can preview the chart with synthetic samples.'}</p><button className="button button-outline" onClick={() => samples ? setSamples(null) : preview()}>{samples ? 'Hide samples' : 'Preview sample readings'}</button></div>}
    <ReadingMetrics reading={latest} />
    {latest && <p className="dash-footnote">Observed {stamp(latest.observedAt)} · {samples ? 'Synthetic samples' : 'Device readings'}{status?.latest?.status === 'stale' && !samples ? ' · Historical values; not current conditions' : ''}</p>}
    <div className="detail-grid"><article className="dash-panel trend-panel"><div className="dash-section-heading"><div><p className="eyebrow">WATER QUALITY</p><h3>Reading history</h3></div><label className="metric-select">Parameter<select value={metric} onChange={e => setMetric(e.target.value as typeof metric)}><option value="dissolvedOxygenMgL">Dissolved oxygen · mg/L</option><option value="ph">pH</option><option value="waterTemperatureC">Temperature · °C</option></select></label></div>
      {loading ? <p role="status">Loading history…</p> : historyFailed && !samples ? <p>Reading history is unavailable. Use Refresh to try again.</p> : <><ReadingChart readings={display} metric={metric} /><p className="dash-footnote">{samples ? 'Rolling synthetic demo readings · updates every 5 seconds' : 'Up to 48 most recent device readings'} · No safety threshold inferred</p></>}
    </article><article id="dash-weather" tabIndex={-1} className="dash-panel"><p className="eyebrow">WEATHER CONTEXT</p><h3>Next 48 hours</h3>{pond.latitude == null || pond.longitude == null ? <p>Add coordinates to this pond before requesting local forecasts.</p> : loading ? <p>Loading forecast…</p> : weather?.forecast ? <><span className="status-pill">{weather.status === 'stale' ? 'Cached forecast · stale' : 'Forecast available'}</span><dl className="weather-list"><div><dt>Total rain</dt><dd>{number(weather.forecast.next48Hours.rainTotalMm.value)} mm</dd></div><div><dt>Peak air temperature</dt><dd>{number(weather.forecast.next48Hours.airTemperatureMaxC.value)} °C</dd></div><div><dt>Peak wind gusts</dt><dd>{number(weather.forecast.next48Hours.windGustMaxKmh.value)} km/h</dd></div></dl><p className="dash-footnote">{weather.forecast.next48Hours.availableSamples}/{weather.forecast.next48Hours.expectedSamples} forecast hours{weather.fetchedAt ? ` · Fetched ${stamp(weather.fetchedAt)}` : ''}. Air temperature is different from pond water temperature.</p><a className="dash-inline-link" href="https://open-meteo.com/" target="_blank" rel="noreferrer">Weather by Open-Meteo ↗</a></> : <p>Forecast unavailable. Check your internet connection and use Refresh to try again.</p>}</article></div>
    {demoMode && <SmsDemo key={pond.id} pondName={pond.name} pondId={pond.id} />}
    <article id="dash-stocking" tabIndex={-1} className="dash-panel"><p className="eyebrow">STOCKING RECORDS</p><h3>What’s growing here</h3>{!cycles.length ? <p>No stocking cycles recorded.</p> : <div className="table-scroll"><table><caption className="sr-only">Stocking cycles for {pond.name}</caption><thead><tr><th>Species</th><th>Quantity</th><th>Density</th><th>Stocked</th><th>Status</th></tr></thead><tbody>{cycles.map(item => <tr key={item.id}><td>{species[item.speciesId] ?? 'Unknown species'}</td><td>{number(item.quantityStocked, 0)}</td><td>{number(item.stockingDensityPerM2, 6)} / m²</td><td>{item.stockingDate}</td><td>{item.status}</td></tr>)}</tbody></table></div>}</article>
  </section>;
}

export default function Dashboard() {
  const [data, setData] = useState<{ operator: Operator; farms: Farm[]; ponds: Pond[]; cycles: Cycle[]; species: Record<string, string>; statuses: Record<string, PondStatus> } | null>(null);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [farmId, setFarmId] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState('');
  const [updated, setUpdated] = useState('');
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const me = await api.me();
        if (!me.data.operator || me.data.operator.accountStatus !== 'active') throw new Error('Sign in and complete an active operator profile to open your dashboard.');
        const [allFarms, allPonds, cycles, catalog] = await Promise.all([listAll<Farm>('/farms'), listAll<Pond>('/ponds'), listAll<Cycle>('/stocking-cycles'), listAll<{ id: string; name: string }>('/species')]);
        const farms = allFarms.filter(item => item.isActive !== false);
        const ponds = allPonds.filter(item => item.isActive !== false && farms.some(farm => farm.id === item.farmId));
        const statuses: Record<string, PondStatus> = {};
        // Bound concurrent per-pond lookups to avoid flooding the API on larger farms.
        for (let start = 0; start < ponds.length; start += 5) {
          if (!active) return;
          await Promise.all(ponds.slice(start, start + 5).map(async pond => {
            const [latest, assessment] = await Promise.allSettled([api.request<Latest>(`/ponds/${encodeURIComponent(pond.id)}/readings/latest`), api.request<Assessment[]>(`/ponds/${encodeURIComponent(pond.id)}/assessments?limit=1`)]);
            statuses[pond.id] = { latest: latest.status === 'fulfilled' ? latest.value.data : null, assessment: assessment.status === 'fulfilled' ? assessment.value.data[0] ?? null : null, assessmentFailed: assessment.status === 'rejected' };
          }));
        }
        if (!active) return;
        setData({ operator: me.data.operator, farms, ponds, cycles, species: Object.fromEntries(catalog.map(item => [item.id, item.name])), statuses });
        setSelected(previous => ponds.some(item => item.id === previous) ? previous : ponds[0]?.id ?? '');
        setUpdated(new Date().toISOString()); setError('');
      } catch (failure) { if (active) setError(failure instanceof Error ? failure.message : 'Dashboard could not be loaded.'); }
      finally { if (active) setLoading(false); }
    }
    void load(); return () => { active = false; };
  }, [refresh]);
  const visible = data?.ponds.filter(pond => (farmId === 'all' || pond.farmId === farmId) && pond.name.toLowerCase().includes(search.toLowerCase())) ?? [];
  const focused = visible.find(pond => pond.id === selected) ?? visible[0];
  const notices = visible.flatMap(pond => { const item = data?.statuses[pond.id]?.assessment; return item ? [{ pond, item }] : []; });
  return <div className="dashboard-page"><SiteHeader dashboard />
    <div className="dash-workspace"><DashboardNav ready={Boolean(data)} hasPond={Boolean(focused)} demo={demoMode} /><main className="dash-main"><div id="dash-overview" tabIndex={-1} className="dash-hero"><div><p className="eyebrow">YOUR FARM AT A GLANCE</p><h1>Every pond.<br /><span>One clear view.</span></h1><p>Follow your water conditions, keep track of your stock,<br className="desktop-break" /> and see what needs a closer look.</p></div><div className="dash-hero-actions"><a className="button button-primary" href="#register-pond">+ Register pond</a><button className="button button-outline" disabled={loading} onClick={() => { setLoading(true); setRefresh(value => value + 1); }}>{loading ? 'Refreshing…' : '↻ Refresh'}</button><small>{updated ? `Last refreshed ${stamp(updated)}` : 'Your farm workspace'}</small></div></div>
    {demoMode && <div className="dash-demo"><span className="small-dot" /><strong>LOCAL DEMO</strong><span>Your browser’s registered ponds. Sample readings are optional and clearly labeled.</span></div>}
    {error && <div role="alert" className="form-message">{error} {data && 'Showing the previous snapshot.'}<a href="#login" className="dash-inline-link">Sign in / complete profile →</a></div>}
    {loading && !data && <p role="status" className="dash-empty">Loading your farm workspace…</p>}
    {data && <><section className="dash-stats" aria-label="Farm summary"><div><span>Registered farms</span><strong>{data.farms.length}</strong><small>Under your operator profile</small></div><div><span>Ponds in view</span><strong>{visible.length}</strong><small>{visible.filter(item => item.isActive).length} active ponds</small></div><div><span>Recent readings</span><strong>{visible.filter(item => data.statuses[item.id]?.latest?.status === 'fresh').length}<small> / {visible.length}</small></strong><small>Freshness, not a safety rating</small></div><div><span>Latest assessments to review</span><strong>{notices.filter(({ item }) => ['warning', 'watch', 'review_required', 'data_unavailable'].includes(item.status)).length}</strong><small>Latest recorded status per pond</small></div></section>
    <ManageRecords farms={data.farms} ponds={data.ponds} onSaved={() => { setFarmId('all'); setRefresh(value => value + 1); }} />
    <section id="dash-ponds" tabIndex={-1} className="pond-overview"><div className="dash-section-heading"><div><p className="eyebrow">YOUR PONDS</p><h2>Small details. A bigger picture.</h2></div><div className="dash-filters"><label>Farm<select value={farmId} onChange={event => setFarmId(event.target.value)}><option value="all">All farms</option>{data.farms.map(farm => <option key={farm.id} value={farm.id}>{farm.name}</option>)}</select></label><label>Find a pond<input type="search" placeholder="Search pond name…" value={search} onChange={event => setSearch(event.target.value)} /></label></div></div>
    {!visible.length ? <div className="dash-empty"><span className="empty-wave">≈</span><h3>{data.ponds.length ? 'No matching ponds.' : 'Your first pond starts here.'}</h3><p>{data.ponds.length ? 'Try another farm or search term.' : 'Register a pond to bring its details, sensor data, and stocking records into this view.'}</p>{!data.ponds.length && <a href="#register-pond" className="button button-primary">Register your first pond →</a>}</div> : <div className="pond-card-grid">{visible.map(pond => { const state = data.statuses[pond.id]; return <button key={pond.id} className={`pond-card ${focused?.id === pond.id ? 'selected' : ''}`} aria-pressed={focused?.id === pond.id} onClick={() => setSelected(pond.id)}><span className="pond-card-top"><span>{data.farms.find(item => item.id === pond.farmId)?.name ?? 'Farm'}</span><span aria-hidden="true">↗</span></span><h3>{pond.name}</h3><span className="pond-card-meta">{number(pond.areaM2)} m² · {pond.waterType}</span><span className="status-pill">{statusLabel(state?.latest?.status)}</span><ReadingMetrics reading={state?.latest?.reading ?? null} /><span className="pond-card-footer">{state?.latest?.reading ? `Observed ${stamp(state.latest.reading.observedAt)}` : 'Waiting for pond data'} · View details →</span></button>; })}</div>}
    </section>
    {focused && <PondDetail key={`${focused.id}-${refresh}`} pond={focused} status={data.statuses[focused.id]} cycles={data.cycles.filter(item => item.pondId === focused.id)} species={data.species} farmName={data.farms.find(item => item.id === focused.farmId)?.name} refresh={refresh} />}
    <section id="dash-alerts" tabIndex={-1} className="dash-panel assessment-panel"><p className="eyebrow">ALERTS & ASSESSMENTS</p><h2>Know what needs a closer look.</h2><p>Latest saved assessment for each pond in view. These records do not update automatically with a new reading.</p>{visible.some(pond => data.statuses[pond.id]?.assessmentFailed) && <p role="status">Some assessments could not be loaded. Refresh to retry.</p>}{!notices.length ? <div className="assessment-empty">No assessments available in this view. This does not mean conditions are safe; readings and reviewed guidance are needed first.</div> : notices.map(({ pond, item }) => <article className="assessment-row" key={item.id}><div><h3>{pond.name}</h3><p>{stamp(item.createdAt)} · {item.source === 'simulated' ? 'Simulated data' : 'Device data'} · {item.confidence} confidence</p></div><span className="status-pill">{assessmentLabel(item.status)}</span></article>)}</section>
    </>}
    </main></div><SiteFooter /><CompanionFish /></div>;
}








