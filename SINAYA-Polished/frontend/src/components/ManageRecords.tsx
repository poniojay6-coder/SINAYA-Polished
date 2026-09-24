import { useState } from 'react';
import { api } from '../lib/supabase';
import type { Farm, Pond } from '../lib/api';
import LocatePond from './LocatePond';
import './ManageRecords.css';

export default function ManageRecords({ farms, ponds, onSaved }: { farms: Farm[]; ponds: Pond[]; onSaved: () => void }) {
  const [editing, setEditing] = useState<{ kind: 'farms' | 'ponds'; row: Farm | Pond } | null>(null);
  const [deleting, setDeleting] = useState<{ kind: 'farms' | 'ponds'; row: Farm | Pond } | null>(null);
  const [busy, setBusy] = useState(false);
  const [farmIndex, setFarmIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const currentIndex = Math.min(farmIndex, Math.max(0, farms.length - 1));
  function moveFarm(delta: number) {
    setDirection(delta); setFarmIndex((currentIndex + delta + farms.length) % farms.length); setError('');
  }
  const [error, setError] = useState('');
  async function save(kind: 'farms' | 'ponds', id: string, body: Record<string, unknown>) {
    setBusy(true); setError('');
    try { await api.request(`/${kind}/${encodeURIComponent(id)}`, { method: 'PATCH', body }); setEditing(null); setDeleting(null); onSaved(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not save changes.'); }
    finally { setBusy(false); }
  }
  return <section id="dash-manage" tabIndex={-1} className="dash-panel registration-card manage-records" aria-label="Manage farms and ponds"><div className="manage-heading"><div><p className="eyebrow">YOUR FARM DIRECTORY</p><h2>Manage farms & ponds</h2></div><span className="manage-count">{farms.length} farms · {ponds.length} ponds</span></div>
    <p>Keep your farm details and pond locations up to date.</p>
    {error && <p role="alert">{error}</p>}
    <fieldset disabled={busy}>
      <div className="manage-carousel" role="region" aria-label="Farm cards" aria-roledescription="carousel"><button className="manage-arrow" type="button" aria-label="Previous farm" disabled={farms.length < 2 || Boolean(editing || deleting)} onClick={() => moveFarm(-1)}>‹</button><div className="manage-card-window">{farms.slice(currentIndex, currentIndex + 1).map(farm => <article className={`manage-farm manage-slide ${direction > 0 ? 'from-right' : 'from-left'}`} key={farm.id}><header className="manage-farm-header"><div className="manage-name"><span className="manage-farm-icon" aria-hidden="true">⌂</span><div><span className="manage-label">FARM</span><h3>{farm.name}</h3><small>{ponds.filter(pond => pond.farmId === farm.id).length} ponds</small></div></div><div className="manage-actions"><button type="button" className="button button-outline" aria-label={`Edit farm ${farm.name}`} onClick={() => { setEditing({ kind: 'farms', row: farm }); setDeleting(null); setError(''); }}>Edit farm</button> <button type="button" className="button button-outline" disabled={ponds.some(pond => pond.farmId === farm.id)} title="Remove this farm’s ponds first" onClick={() => { setDeleting({ kind: 'farms', row: farm }); setEditing(null); setError(''); }}>Delete farm</button></div></header><div className="manage-ponds">
        {ponds.filter(pond => pond.farmId === farm.id).map(pond => <div className="manage-pond" key={pond.id}><div className="manage-pond-name"><span className="manage-label">POND</span><strong>{pond.name}</strong><small>{Number(pond.areaM2).toLocaleString()} m² · {pond.waterType}</small></div><div className="manage-actions"><button type="button" className="button button-outline" aria-label={`Edit pond ${pond.name}`} onClick={() => { setEditing({ kind: 'ponds', row: pond }); setDeleting(null); setError(''); }}>Edit pond</button> <button type="button" className="button button-outline" aria-label={`Delete pond ${pond.name}`} onClick={() => { setDeleting({ kind: 'ponds', row: pond }); setEditing(null); setError(''); }}>Delete pond</button></div></div>)}
      {!ponds.some(pond => pond.farmId === farm.id) && <p className="manage-empty">No ponds added yet.</p>}</div></article>)}</div><button className="manage-arrow" type="button" aria-label="Next farm" disabled={farms.length < 2 || Boolean(editing || deleting)} onClick={() => moveFarm(1)}>›</button></div><p className="manage-position" role="status">{farms.length ? `Farm ${currentIndex + 1} of ${farms.length}` : 'No farms yet'}</p><p className="manage-note">Deleting archives a record and keeps its history. Remove all ponds before deleting their farm.</p>
      {editing && <form className="manage-editor" key={editing.row.id} onSubmit={event => {
        event.preventDefault(); const values = new FormData(event.currentTarget);
        const body: Record<string, unknown> = { name: String(values.get('name')).trim() };
        if (editing.kind === 'ponds') {
          body.areaM2 = Number(values.get('areaM2')); body.waterType = values.get('waterType');
          const lat = String(values.get('latitude') ?? ''), lon = String(values.get('longitude') ?? '');
          if (Boolean(lat) !== Boolean(lon)) { setError('Enter both coordinates or clear both.'); return; }
          body.latitude = lat ? Number(lat) : null; body.longitude = lon ? Number(lon) : null;
        } else for (const field of ['region', 'province', 'municipalityCity', 'barangay']) {
          const value = String(values.get(field) ?? '').trim(); if (value) body[field] = value;
        }
        void save(editing.kind, editing.row.id, body);
      }}><h3>Edit {editing.row.name}</h3><label>Name<input name="name" required maxLength={200} defaultValue={editing.row.name} /></label>
        {editing.kind === 'ponds' ? <><label>Pond area (m²)<input name="areaM2" type="number" min="0.01" max="999999999999.99" step="0.01" required defaultValue={(editing.row as Pond).areaM2} /></label><label>Water type<select name="waterType" defaultValue={(editing.row as Pond).waterType}><option value="freshwater">Freshwater</option><option value="brackish">Brackish</option><option value="marine">Marine</option></select></label><LocatePond /><div className="form-pair"><label>Latitude<input name="latitude" type="number" min="-90" max="90" step="any" defaultValue={(editing.row as Pond).latitude ?? ''} /></label><label>Longitude<input name="longitude" type="number" min="-180" max="180" step="any" defaultValue={(editing.row as Pond).longitude ?? ''} /></label></div><p>Existing stocking density retains the area recorded when stock was added.</p></> : <>{['region', 'province', 'municipalityCity', 'barangay'].map(field => <label key={field}>{field === 'municipalityCity' ? 'City / Municipality' : field[0]!.toUpperCase() + field.slice(1)}<input name={field} maxLength={200} defaultValue={String((editing.row as unknown as Record<string, unknown>)[field] ?? '')} /></label>)}</>}
        <button className="button button-primary" type="submit">{busy ? 'Saving…' : 'Save changes'}</button> <button className="button button-outline" type="button" onClick={() => setEditing(null)}>Cancel</button>
      </form>}
      {deleting && <div className="manage-confirm" role="alert"><p>Delete <strong>{deleting.row.name}</strong> from the dashboard? Historical records will be retained.</p><button type="button" className="button button-primary" onClick={() => void save(deleting.kind, deleting.row.id, { isActive: false })}>Confirm deletion</button> <button type="button" className="button button-outline" onClick={() => setDeleting(null)}>Cancel</button></div>}
    </fieldset>
  </section>;
}



