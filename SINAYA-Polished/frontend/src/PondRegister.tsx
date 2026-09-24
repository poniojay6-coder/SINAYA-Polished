import SiteHeader from './components/SiteHeader';
import SiteFooter from './components/SiteFooter';
import { demoMode } from './lib/demo';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { api, supabase } from './lib/supabase';
import type { Farm, Operator, Pond } from './lib/api';
import CompanionFish from './components/CompanionFish';
import LocatePond from './components/LocatePond';
import EquipmentPicker from './components/EquipmentPicker';
import type { ToolSelection } from './components/EquipmentPicker';
import AddressFields from './components/AddressFields';
import './Register.css';
import './PondRegister.css';

type Species = { id: string; name: string };
type Cycle = { id: string; stockingDensityPerM2: string; quantityStocked: number };
const steps = ['Farm', 'Pond details', 'Stocking', 'Tools & sensor'];
function rememberPond(operatorId: string, pondId?: string) {
  // Storage restrictions must not turn a successful server save into a failed step.
  try {
    const key = `sinaya.pond-setup.${operatorId}`;
    if (pondId) sessionStorage.setItem(key, pondId);
    else sessionStorage.removeItem(key);
  } catch { /* In-memory progression remains available. */ }
}
async function allPages<T>(path: string): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data } = await api.request<T[]>(`${path}?limit=100&offset=${offset}`);
    rows.push(...data);
    if (data.length < 100) return rows;
  }
}

export default function PondRegister() {
  const [loading, setLoading] = useState(true);
  const [operator, setOperator] = useState<Operator | null>(null);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [species, setSpecies] = useState<Species[]>([]);
  const [step, setStep] = useState(0);
  const [farmId, setFarmId] = useState('');
  const [farmAddress, setFarmAddress] = useState({ region: '', province: '', municipalityCity: '', barangay: '' });
  const drafts = useRef<Record<number, Record<string, string>>>({});
  const [draftNames, setDraftNames] = useState<Record<number, string>>({});
  const formRef = useRef<HTMLFormElement>(null);
  const [farm, setFarm] = useState<Farm | null>(null);
  const [pond, setPond] = useState<Pond | null>(null);
  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [sensor, setSensor] = useState('');
  const [tools, setTools] = useState<ToolSelection[]>([]);
  const [toolsReady, setToolsReady] = useState(false);
  const [area, setArea] = useState('');
  const [quantity, setQuantity] = useState('');
  const [stockingDate, setStockingDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const saving = useRef(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        if (!supabase && !demoMode) throw new Error('Account access is not configured. Please finish Supabase setup first.');
        const { data } = await api.me();
        if (!data.operator) throw new Error('Complete your operator profile before adding a pond.');
        if (data.operator.accountStatus !== 'active') throw new Error('Your operator account must be active to register a pond.');
        const [owned, catalog] = await Promise.all([allPages<Farm>('/farms'), allPages<Species>('/species')]);
        if (!active) return;
        setOperator(data.operator);
        setFarms(owned.filter(item => item.isActive));
        setSpecies(catalog);
        setFarmId(owned.find(item => item.isActive)?.id ?? 'new');
        let savedId: string | null = null;
        try { savedId = sessionStorage.getItem(`sinaya.pond-setup.${data.operator.id}`); } catch { /* Storage is optional. */ }
        if (savedId) {
          const saved = (await api.request<Pond>(`/ponds/${encodeURIComponent(savedId)}`)).data;
          const parent = owned.find(item => item.id === saved.farmId && item.isActive);
          if (parent && saved.isActive) {
            const cycles = (await api.request<(Cycle & { status: string })[]>(`/stocking-cycles?pondId=${encodeURIComponent(saved.id)}&limit=100`)).data;
            const units = (await api.request<{ serialNumber: string; isActive: boolean }[]>(`/ponds/${encodeURIComponent(saved.id)}/sensors?limit=100`)).data;
            if (!active) return;
            const currentCycle = cycles.find(item => item.status === 'active');
            const unit = units.find(item => item.isActive);
            setFarm(parent); setPond(saved); setArea(saved.areaM2);
            setCycle(currentCycle ?? null); setSensor(unit?.serialNumber ?? '');
            setStep(currentCycle ? unit ? 4 : 3 : 2);
          } else rememberPond(data.operator.id);
        }
        setError('');
      } catch (failure) { if (active) setError(failure instanceof Error ? failure.message : 'Could not load your farm information.'); }
      finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [attempt]);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [step]);
  useEffect(() => { if (step === 4 && operator) rememberPond(operator.id); }, [step, operator]);

  function capture() {
    if (formRef.current) { drafts.current[step] = Object.fromEntries(new FormData(formRef.current).entries()) as Record<string, string>; setDraftNames(names => ({ ...names, [step]: drafts.current[step]?.name ?? '' })); }
  }
  function back() {
    capture(); setError(''); setStep(current => Math.max(0, current - 1));
  }
  useEffect(() => {
    const draft = drafts.current[step];
    if (!draft || !formRef.current) return;
    for (const [name, value] of Object.entries(draft)) {
      const field = formRef.current.elements.namedItem(name);
      if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement) field.value = value;
    }
  }, [step]);

  async function finish(skipSensor: boolean) {
    if (!operator || saving.current) return;
    if (!toolsReady) { setError('Wait for the equipment list to load, or retry tools.'); return; }
    if (tools.some(tool => !Number.isInteger(tool.quantity) || tool.quantity < 1 || tool.quantity > 2147483647)) { setError('Enter a whole-number quantity of at least 1 for each selected tool.'); return; }
    saving.current = true; setBusy(true); setError(''); capture();
    try {
      const inventoryPath = '/farmers/' + operator.id + '/equipment';
      const inventory = await allPages<{ equipmentId: string | null }>(inventoryPath);
      for (const tool of tools) {
        if (!inventory.some(item => item.equipmentId === tool.equipmentId)) {
          await api.request(inventoryPath, { method: 'POST', body: tool });
        }
      }
      let selectedFarm = farm;
      if (!selectedFarm) {
        if (farmId !== 'new') selectedFarm = farms.find(item => item.id === farmId) ?? null;
        else selectedFarm = (await api.request<Farm>('/farms', { method: 'POST', body: { ...drafts.current[0], operatorId: operator.id, notifyOperator: true } })).data;
        if (!selectedFarm) throw new Error('Select a farm first.');
        setFarm(selectedFarm);
      }
      let savedPond = pond;
      if (!savedPond) {
        const input = drafts.current[1]!;
        savedPond = (await api.request<Pond>('/ponds', { method: 'POST', body: {
          farmId: selectedFarm.id, name: input.name, areaM2: Number(input.areaM2), waterType: input.waterType,
          ...(input.latitude && input.longitude ? { latitude: Number(input.latitude), longitude: Number(input.longitude) } : {}),
        } })).data;
        setPond(savedPond); rememberPond(operator.id, savedPond.id);
      }
      if (demoMode) await api.request('/ponds/' + savedPond.id + '/equipment', { method: 'PATCH', body: { tools } });
      if (!cycle) {
        const input = drafts.current[2]!;
        const savedCycle = (await api.request<Cycle>('/stocking-cycles', { method: 'POST', body: {
          pondId: savedPond.id, speciesId: input.speciesId, quantityStocked: Number(input.quantityStocked), stockingDate: input.stockingDate,
          ...(input.expectedHarvestDate ? { expectedHarvestDate: input.expectedHarvestDate } : {}),
        } })).data;
        setCycle(savedCycle);
      }
      if (!skipSensor) {
        const serialNumber = drafts.current[3]?.serialNumber?.trim();
        if (!serialNumber) throw new Error('Enter a sensor serial number or choose setup later.');
        await api.request('/ponds/' + encodeURIComponent(savedPond.id) + '/sensors', { method: 'POST', body: { serialNumber } });
        setSensor(serialNumber);
      }
      setStep(4);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to finish setup. Retry to continue from the saved records.'); }
    finally { saving.current = false; setBusy(false); }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    capture(); setError('');
    if (step === 1) {
      const input = drafts.current[1]!;
      if (Boolean(input.latitude) !== Boolean(input.longitude)) { setError('Enter both latitude and longitude, or leave both blank.'); return; }
    }
    if (step === 2) {
      const input = drafts.current[2]!;
      if (input.expectedHarvestDate && input.expectedHarvestDate < input.stockingDate!) { setError('Expected harvest must be on or after the stocking date.'); return; }
    }
    if (step === 3) { await finish(false); return; }
    setStep(current => current + 1);
  }

  const density = Number(area) > 0 && Number(quantity) > 0 ? Number(quantity) / Number(area) : null;
  const titles = ['Choose your farm.', 'Give your pond a place.', 'What’s growing here?', 'Your tools and sensor.', 'Your pond is registered.'];
  return <><SiteHeader /><main className="registration-page pond-page"><div className="registration-shell">
    <header className="registration-header"><a className="registration-back" href="#home">← Back to home</a>{demoMode && <div className="demo-shortcut"><a className="button button-primary" href="#dashboard">Open demo dashboard <span aria-hidden="true">↗</span><small>No login needed</small></a><span>Explore saved ponds and sample readings</span></div>}</header>
    <div className="registration-layout"><aside className="registration-story"><p className="eyebrow">ONE FARM. EVERY POND.</p><h1>A clearer view,<br /><span>pond by pond.</span></h1><p>Start with the details that make this pond unique. Its size, species, and stocking density bring context to every water-quality reading.</p>
      <ol className="pond-steps" aria-label="Pond registration progress">{steps.map((name, index) => <li key={name} aria-current={index === step ? 'step' : undefined} className={index < step ? 'complete' : ''}><span>{index < step ? '✓' : `0${index + 1}`}</span><div>{name}<small>{['Select an existing farm or add one', 'Self-reported area and water type', 'Species, quantity, and dates', 'A dedicated unit for this pond'][index]}</small></div></li>)}</ol>
      <p className="registration-prototype">Dedicated sensors measure dissolved oxygen, pH, and water temperature. Weather forecasts add local context.</p>
    </aside><section className="registration-card" aria-labelledby="pond-title"><p className="eyebrow">{step < 4 ? `POND SETUP / 0${step + 1}` : 'SETUP SAVED'}</p><h2 id="pond-title" ref={heading} tabIndex={-1}>{titles[step]}</h2>
      {loading ? <p role="status">Loading your farms and species…</p> : !operator ? <div><p role="alert" className="form-message">{error}</p><a className="button button-primary" href="#login">Sign in / complete profile →</a><button className="registration-signout" onClick={() => { setLoading(true); setAttempt(value => value + 1); }}>Retry connection</button></div> : <>
      {error && <p role="alert" className="form-message">{error} {(farm || pond) && 'Earlier records are saved. Retry to finish the remaining steps.'}</p>}
      {step < 4 ? <form ref={formRef} key={step} onSubmit={save}><fieldset disabled={busy}>
        {step === 0 && <><p>A farm groups your ponds under one operator. Use the farm’s physical address below.</p><label>Farm<select value={farmId} onChange={event => setFarmId(event.target.value)} required>{farms.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}<option value="new">+ Add a new farm</option></select></label>{farmId === 'new' && <><label>Farm name<input name="name" placeholder="e.g. Riverside Aquaculture Farm" required maxLength={200} /></label><AddressFields value={farmAddress} onChange={setFarmAddress} /></>}</>}
        {step === 1 && <><p>Register a pond at <strong>{farm?.name ?? (farmId === 'new' ? draftNames[0] : farms.find(item => item.id === farmId)?.name)}</strong>. Enter the measured or known surface area.</p><label>Pond name<input name="name" required maxLength={200} placeholder="e.g. Grow-out Pond 01" /></label><div className="form-pair"><label>Pond area (m²)<input name="areaM2" type="number" min="0.01" max="999999999999.99" step="0.01" required value={area} onChange={event => setArea(event.target.value)} /></label><label>Water type<select name="waterType" defaultValue="" required><option value="" disabled>Select water type</option><option value="freshwater">Freshwater</option><option value="brackish">Brackish</option><option value="marine">Marine</option></select></label></div><small>1 hectare = 10,000 m². Pond area is self-reported.</small><div className="pond-location"><p className="eyebrow">WEATHER LOCATION · OPTIONAL</p><LocatePond /><div className="form-pair"><label>Latitude<input name="latitude" type="number" min="-90" max="90" step="any" placeholder="e.g. 7.0700" /></label><label>Longitude<input name="longitude" type="number" min="-180" max="180" step="any" placeholder="e.g. 125.6000" /></label></div></div></>}
        {step === 2 && <><p>Add the current stocking cycle. You can go back to correct details before finishing.</p><label>Species<select name="speciesId" defaultValue="" required><option value="" disabled>Select a species</option>{species.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>{!species.length && <p role="alert">No active species are available. Load the species catalog before continuing.</p>}<label>Quantity stocked<input name="quantityStocked" type="number" min="1" max="2147483647" step="1" required value={quantity} onChange={event => setQuantity(event.target.value)} /></label><div className="density-preview" role="status"><span>Stocking density</span><strong>{density === null ? '—' : density.toLocaleString(undefined, { maximumFractionDigits: 6 })} <small>stock / m²</small></strong><p>Quantity stocked ÷ {Number(area).toLocaleString()} m². This describes stocking, not a safety rating.</p></div><div className="form-pair"><label>Stocking date<input name="stockingDate" type="date" required value={stockingDate} onChange={event => setStockingDate(event.target.value)} /></label><label>Expected harvest (optional)<input name="expectedHarvestDate" type="date" min={stockingDate || undefined} /></label></div></>}
        {step === 3 && <><EquipmentPicker farmerId={operator.id} value={tools} onChange={setTools} onReady={setToolsReady} /><p>Link the dedicated sensor unit installed in <strong>{pond?.name ?? draftNames[1]}</strong>. Each pond supports one active unit connected through the shared farm gateway.</p><label>Sensor serial number<input name="serialNumber" maxLength={100} required placeholder="Enter the serial printed on the unit" /></label><p className="pond-help">Linking a serial number records the assignment. Live monitoring starts when the device sends readings.</p></>}
        <button className="button button-primary register-submit" type="submit" disabled={(step === 2 && !species.length) || (step === 3 && !toolsReady)}>{busy ? 'Saving…' : ['Continue to pond →', 'Continue to stocking →', 'Continue to sensor →', 'Save pond & link sensor →'][step]}</button>
        {step > 0 && <button type="button" className="button button-outline register-submit" onClick={back} disabled={Boolean(farm || pond)}>← Back</button>}
        {(farm || pond) && <p className="pond-help">Some records are already saved. Finish this setup to keep those records consistent.</p>}
        {step === 3 && <button type="button" className="registration-signout" disabled={!toolsReady} onClick={() => void finish(true)}>Save pond · set up sensor later</button>}
      </fieldset></form> : <><p><strong>{pond?.name}</strong> is registered under {farm?.name}.</p><dl className="pond-summary"><div><dt>Pond area</dt><dd>{Number(pond?.areaM2).toLocaleString()} m²</dd></div><div><dt>Water type</dt><dd>{pond?.waterType}</dd></div><div><dt>Stocking density</dt><dd>{Number(cycle?.stockingDensityPerM2).toLocaleString(undefined, { maximumFractionDigits: 6 })} stock / m²</dd></div><div><dt>Sensor</dt><dd>{sensor ? `Linked: ${sensor}` : 'Awaiting installation'}</dd></div><div><dt>Weather location</dt><dd>{pond?.latitude != null && pond?.longitude != null ? 'Coordinates saved' : 'Coordinates still needed'}</dd></div></dl><p>Readings and reviewed species guidance are needed before advisories can be generated.</p><button className="button button-primary register-submit" onClick={() => { drafts.current = {}; setFarm(null); setFarmId(farm?.id ?? farmId); setFarms(items => farm && !items.some(item => item.id === farm.id) ? [...items, farm] : items); setTools([]); setPond(null); setCycle(null); setSensor(''); setArea(''); setQuantity(''); setStockingDate(''); setError(''); setStep(1); }}>Register another pond →</button><a href="#dashboard" className="button button-primary register-submit">Open dashboard →</a></>}
      </>}
      <p className="registration-footnote">Your pond details stay connected to your farm.</p>
    </section></div></div><SiteFooter /><CompanionFish /></main></>;
}






