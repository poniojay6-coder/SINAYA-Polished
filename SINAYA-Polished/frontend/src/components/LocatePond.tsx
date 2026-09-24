import { useEffect, useRef, useState } from 'react';
export default function LocatePond() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  return <><button type="button" className="button button-outline" disabled={busy} onClick={event => {
    const form = event.currentTarget.closest('form');
    if (!navigator.geolocation) { setMessage('Location is unavailable on this device. Enter coordinates manually.'); return; }
    setBusy(true); setMessage('Allow location access in your browser.');
    navigator.geolocation.getCurrentPosition(position => {
      if (!mounted.current || !form?.isConnected) return;
      const latitude = form.elements.namedItem('latitude');
      const longitude = form.elements.namedItem('longitude');
      if (latitude instanceof HTMLInputElement && longitude instanceof HTMLInputElement) {
        latitude.value = position.coords.latitude.toFixed(6);
        longitude.value = position.coords.longitude.toFixed(6);
      }
      setBusy(false); setMessage(`Location filled (estimated accuracy ±${Math.round(position.coords.accuracy)} m). Check that you are at the pond before saving.`);
    }, error => {
      if (!mounted.current) return;
      setBusy(false); setMessage(error.code === 1 ? 'Location permission was denied. Allow it in browser settings or enter coordinates manually.' : 'Could not locate you. Try again outdoors or enter coordinates manually.');
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  }}>{busy ? 'Finding your location…' : 'Use my current location'}</button><p>Use this while at the pond. Your device location may be different from your farm’s location.</p>{message && <p role="status">{message}</p>}</>;
}
