import { useEffect, useState } from 'react';
import { api } from '../lib/supabase';
export type ToolSelection = { equipmentId: string; quantity: number };
export default function EquipmentPicker({ farmerId, value, onChange, onReady }: { farmerId: string; value: ToolSelection[]; onChange: (value: ToolSelection[]) => void; onReady: (ready: boolean) => void }) {
  const [catalog, setCatalog] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    onReady(false);
    async function pages<T>(path: string) {
      const rows: T[] = [];
      for (let offset = 0; ; offset += 100) {
        const result = await api.request<T[]>(`${path}?limit=100&offset=${offset}`);
        rows.push(...result.data); if (result.data.length < 100) return rows;
      }
    }
    pages<{ id: string; name: string }>('/equipment')
      .then(tools => { if (active) { setCatalog(tools); setError(false); onReady(true); } })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [farmerId, attempt, onReady]);
  return <section aria-label="Farmer tools"><p className="eyebrow">TOOLS AVAILABLE AT THIS POND</p><p>Select only tools that are working and available at this pond. Tools at another pond are not selected automatically.</p>
    {error && <p role="alert">Tools could not load. <button type="button" onClick={() => setAttempt(n => n + 1)}>Retry tools</button></p>}
    {catalog.map(tool => {
      const selected = value.find(item => item.equipmentId === tool.id);
      return <div key={tool.id}><label className="consent-field"><input type="checkbox" checked={Boolean(selected)} onChange={event => onChange(event.target.checked ? [...value, { equipmentId: tool.id, quantity: 1 }] : value.filter(item => item.equipmentId !== tool.id))} /><span>{tool.name}</span></label>
        {selected && <label>{tool.name} quantity<input type="number" min="1" max="2147483647" step="1" required value={selected.quantity || ''} onChange={event => onChange(value.map(item => item.equipmentId === tool.id ? { ...item, quantity: Number(event.target.value) } : item))} /></label>}
      </div>;
    })}<small>Leave all unchecked if no tools are available here.</small>
  </section>;
}


