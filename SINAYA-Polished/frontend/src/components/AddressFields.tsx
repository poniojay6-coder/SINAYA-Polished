import { useEffect, useRef, useState } from 'react';

export type Address = { region: string; province: string; municipalityCity: string; barangay: string };
type Place = { code: string; name: string; province?: string | null };
const noProvince = 'Not applicable';

function usePlaces(path: string) {
  const [result, setResult] = useState<{ path: string; items: Place[]; error: boolean }>({ path: '', items: [], error: false });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let active = true;
    async function load() {
      try {
        const response = await fetch(`https://psgc.cloud/api/v2/${path}`, { signal: controller.signal });
        if (!response.ok) throw new Error('Address lookup failed');
        const payload = await response.json();
        const rows: unknown = Array.isArray(payload) ? payload : payload.data;
        if (!Array.isArray(rows) || !rows.every(row => typeof row.code === 'string' && typeof row.name === 'string')) throw new Error('Invalid address list');
        const items = (rows as Place[]).map(row => ({ ...row, name: row.name.trim(), province: row.province?.trim() })).sort((a, b) => a.name.localeCompare(b.name));
        if (active) setResult({ path, items, error: false });
      } catch { if (active) setResult({ path, items: [], error: true }); }
      finally { clearTimeout(timeout); }
    }
    void load();
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [path, retry]);
  return { items: result.path === path ? result.items : [], loading: Boolean(path) && result.path !== path, error: result.path === path && result.error, retry: () => { setResult({ path: '', items: [], error: false }); setRetry(n => n + 1); } };
}

export default function AddressFields({ value, onChange }: { value: Address; onChange: (address: Address) => void }) {
  const [openField, setOpenField] = useState<keyof Address | null>(null);
  const openingClick = useRef(false);
  const regions = usePlaces('regions');
  const region = regions.items.find(item => item.name === value.region);
  const cities = usePlaces(region ? `regions/${region.code}/cities-municipalities` : '');
  const provinces = [...new Set(cities.items.map(city => city.province || noProvince))].sort();
  const filteredCities = cities.items.filter(city => (city.province || noProvince) === value.province);
  const city = filteredCities.find(item => item.name === value.municipalityCity);
  const barangays = usePlaces(city ? `cities-municipalities/${city.code}/barangays` : '');
  function change(field: keyof Address, next: string) {
    const fields: (keyof Address)[] = ['region', 'province', 'municipalityCity', 'barangay'];
    const address = { ...value, [field]: next };
    fields.slice(fields.indexOf(field) + 1).forEach(child => { address[child] = ''; });
    onChange(address);
  }
  function select(field: keyof Address, label: string, options: string[], loading: boolean) {
    const expanded = openField === field;
    return <label className="address-dropdown">{label}<select name={field} required
      size={expanded ? Math.min(5, Math.max(2, options.length + 1)) : 1}
      className={expanded ? 'address-dropdown-open' : ''}
      value={options.includes(value[field]) ? value[field] : ''}
      onMouseDown={event => { openingClick.current = !expanded; if (!expanded) { event.preventDefault(); event.currentTarget.focus(); setOpenField(field); } }}
      onBlur={() => setOpenField(null)}
      onKeyDown={event => {
        if (event.key === 'Escape' || (expanded && event.key === 'Enter')) { event.preventDefault(); setOpenField(null); }
        else if (!expanded && ['ArrowDown', 'ArrowUp', ' ', 'Enter'].includes(event.key)) { event.preventDefault(); setOpenField(field); }
      }}
      onChange={event => change(field, event.target.value)}
      onClick={() => { if (!openingClick.current && expanded) setOpenField(null); openingClick.current = false; }}
      aria-busy={loading}>
      <option value="">{loading ? 'Loading…' : `Select ${label.toLowerCase()}`}</option>
      {options.map(name => <option key={name} value={name}>{name}</option>)}
    </select></label>;
  }
  const failed = [regions, cities, barangays].filter(list => list.error);
  return <>
    <div className="form-pair">{select('region', 'Region', regions.items.map(item => item.name), regions.loading)}{select('province', 'Province', provinces, cities.loading)}</div>
    <div className="form-pair">{select('municipalityCity', 'City / Municipality', filteredCities.map(item => item.name), cities.loading)}{select('barangay', 'Barangay', barangays.items.map(item => item.name), barangays.loading)}</div>
    {value.province === noProvince && <small>This area has no province in PSGC.</small>}
    {failed.length > 0 && <p role="alert" className="form-message">Unable to load addresses. Check your connection. <button type="button" onClick={() => failed.forEach(list => list.retry())}>Retry addresses</button></p>}
    <small>Choose your address in order. Address directory by <a href="https://psgc.cloud" target="_blank" rel="noreferrer">PSGC Cloud</a>.</small>
  </>;
}
