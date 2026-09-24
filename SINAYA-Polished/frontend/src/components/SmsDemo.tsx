import { useEffect, useState } from 'react';
import { api } from '../lib/supabase';
import './SmsDemo.css';

const scenarios = [
  { id: 'oxygen', title: 'Low oxygen', readings: 'DO 2.5 mg/L · pH 7.4 · Water 28°C', explanation: 'Demonstrates an oxygen alert.', text: 'Low dissolved oxygen scenario detected. Verify the reading and contact the farm operator for assessment.' },
  { id: 'ph', title: 'Unusual pH', readings: 'DO 5.5 mg/L · pH 9.5 · Water 28°C', explanation: 'Demonstrates a pH alert.', text: 'Unusual pH scenario detected. Verify the reading and request an operator review.' },
  { id: 'temperature', title: 'High water temperature', readings: 'DO 5.5 mg/L · pH 7.4 · Water 35°C', explanation: 'Demonstrates a water-temperature alert.', text: 'High water temperature scenario detected. Verify the reading and request an operator review.' },
  { id: 'rain', title: 'Heavy rain', readings: 'Sample forecast: 100 mm rain / 48 hours', explanation: 'Uses a fictional weather scenario, separate from the live Open-Meteo forecast.', text: 'Heavy rain forecast scenario. Review local weather information and notify the farm operator.' },
  { id: 'normal', title: 'Normal readings', readings: 'DO 5.5 mg/L · pH 7.4 · Water 28°C', explanation: 'Demonstrates the no-alert branch. These values are not a species-specific safety assessment.', text: null },
  { id: 'offline', title: 'Disconnected sensor', readings: 'No current reading · sample device offline', explanation: 'Demonstrates a maintenance notice rather than a water-quality conclusion.', text: 'Sensor connection unavailable in this scenario. Check the device connection; current pond conditions are unknown.' },
] as const;
type Scenario = typeof scenarios[number];
type Delivery = { id: string; title: string; time: string; message: string };

export default function SmsDemo({ pondName, pondId }: { pondName: string; pondId?: string }) {
  const [tools, setTools] = useState<string[] | null>(null);
  const [catalog, setCatalog] = useState<{ id: string; name: string }[]>([]);
  const [toolError, setToolError] = useState('');
  const [savingTools, setSavingTools] = useState(false);
  useEffect(() => {
    let active = true;
    async function pages<T>(path: string) {
      const rows: T[] = [];
      for (let offset = 0; ; offset += 100) {
        const result = await api.request<T[]>(`${path}?limit=100&offset=${offset}`);
        rows.push(...result.data); if (result.data.length < 100) return rows;
      }
    }
    async function load() {
      try {
        if (!pondId) return;
        const [catalog, owned] = await Promise.all([pages<{ id: string; name: string }>('/equipment'), api.request<{ equipmentId: string; quantity: number }[]>(`/ponds/${pondId}/equipment`).then(result => result.data)]);
        if (active) { setCatalog(catalog); setTools(catalog.filter(tool => owned.some(item => item.equipmentId === tool.id && item.quantity > 0)).map(tool => tool.name)); }
      } catch { /* Unknown inventory must not imply equipment ownership. */ }
    }
    void load(); return () => { active = false; };
  }, [pondId]);
  const [selected, setSelected] = useState<Scenario>(scenarios[0]);
  const [running, setRunning] = useState(false);
  const [delivered, setDelivered] = useState(false);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  async function changeTools(name: string, checked: boolean) {
    if (!pondId || tools === null || savingTools) return;
    const next = checked ? [...tools, name] : tools.filter(tool => tool !== name);
    setSavingTools(true); setToolError('');
    try {
      await api.request(`/ponds/${pondId}/equipment`, { method: 'PATCH', body: { tools: catalog.filter(tool => next.includes(tool.name)).map(tool => ({ equipmentId: tool.id, quantity: 1 })) } });
      setTools(next); setRunning(false); setDelivered(false);
    } catch { setToolError('Could not save this pond’s tools. Please retry.'); }
    finally { setSavingTools(false); }
  }
  const relevantTool = tools?.find(name => selected.id === 'oxygen' ? /aerat/i.test(name) : selected.id === 'offline' ? /generator/i.test(name) : /test|meter/i.test(name));
  const equipmentNote = relevantTool ? `${relevantTool} is listed in your inventory. Ask the operator to confirm it is working and available before choosing an action.` : tools === null ? 'Equipment inventory unavailable; request operator assessment.' : 'No matching tool is recorded for this demo scenario; request operator assessment.';
  const message = selected.text ? `SINAYA DEMO — SIMULATED DATA\nPond: ${pondName}\n${selected.readings}\n${selected.text}\n${equipmentNote}\nPresentation only; not an operational advisory.` : '';
  return <article id="dash-sms" tabIndex={-1} className="dash-panel sms-demo" aria-labelledby="sms-demo-title">
    <p className="eyebrow">PRESENTATION MODE · SMS SIMULATOR</p>
    <h3 id="sms-demo-title">Show how pond alerts work</h3>
    <p>Choose a scenario, run it, then simulate delivery to a fictional operator. No real SMS is sent. Sample messages use fixed demonstration wording, not AI-generated or approved aquaculture instructions.</p>
    {tools !== null && <fieldset disabled={savingTools}><legend>Tools available at {pondName} · demo</legend><p>Adjust this pond’s tools for your presentation. Older ponds start with none selected.</p>{catalog.map(tool => <label key={tool.id} style={{ display: 'block', margin: '10px 0' }}><input type="checkbox" checked={tools.includes(tool.name)} onChange={event => void changeTools(tool.name, event.target.checked)} /> {tool.name}</label>)}</fieldset>}
    {toolError && <p role="alert">{toolError}</p>}
    <div className="sms-scenarios" role="group" aria-label="SMS demo scenarios">{scenarios.map(item => <button type="button" key={item.id} aria-pressed={selected.id === item.id} onClick={() => { setSelected(item); setRunning(false); setDelivered(false); }}>{item.title}</button>)}</div>
    <div className="sms-demo-layout"><div>
      <h4>{selected.title}</h4><p className="sms-sample">{selected.readings}</p><p>{selected.explanation}</p><p>Saved tools: {tools === null ? 'Unavailable / loading' : tools.length ? tools.join(', ') : 'None recorded'}</p>
      <p className="dash-footnote">Scenario outcomes are scripted fixtures. No production thresholds, sensor readings, or live weather are changed.</p>
      <button type="button" className="button button-outline" onClick={() => { setRunning(true); setDelivered(false); }}>Run scenario</button>
      <ol className="sms-demo-steps"><li>{running ? '✓ Scenario loaded' : 'Choose and run a scenario'}</li><li>{!running ? 'Preview the message' : selected.text ? '✓ Demo message prepared' : '✓ No alert generated'}</li><li>{delivered ? '✓ Simulated delivery recorded' : selected.text ? 'Simulate delivery' : 'No delivery needed'}</li></ol>
    </div><div className="sms-phone" aria-label="SMS phone preview"><div className="sms-phone-top">SINAYA · Demo operator</div>
      {running ? selected.text ? <p className="sms-bubble">{message}</p> : <p className="sms-bubble">No alert for this scripted scenario. No SMS is queued.</p> : <p className="sms-phone-empty">Run a scenario to preview its message.</p>}
      <button type="button" className="button button-primary" disabled={!running || !selected.text || delivered} onClick={() => {
        if (!running || !selected.text || delivered) return;
        setDeliveries(rows => [{ id: crypto.randomUUID(), title: selected.title, time: new Date().toLocaleTimeString(), message }, ...rows].slice(0, 20));
        setDelivered(true);
      }}>{delivered ? 'Delivery simulated ✓' : 'Simulate SMS delivery'}</button>
      <p role="status" className="dash-footnote">{delivered ? 'Recorded locally for this presentation. No phone was contacted.' : 'Fictional recipient · No phone number required'}</p>
    </div></div>
    <div className="sms-log-heading"><h4>Simulated delivery log</h4><button type="button" className="button button-outline" disabled={!deliveries.length} onClick={() => { setDeliveries([]); setDelivered(false); }}>Clear demo log</button></div>
    {!deliveries.length ? <p>No simulated deliveries yet.</p> : <ul className="sms-log">{deliveries.map(item => <li key={item.id}><details><summary>{item.time} · {item.title} · Simulated delivery</summary><p>{item.message}</p></details></li>)}</ul>}
    <p className="dash-footnote">Log keeps the latest 20 entries for this pond view and clears when you leave it.</p>
  </article>;
}

