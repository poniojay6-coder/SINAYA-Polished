import { useEffect, useState } from 'react';
export default function DashboardNav({ ready, hasPond, demo }: { ready: boolean; hasPond: boolean; demo: boolean }) {
  const items = [['dash-overview', 'Overview'], ...(ready ? [['dash-manage', 'Manage farms'], ['dash-ponds', 'Your ponds']] : []), ...(hasPond ? [['dash-readings', 'Water readings'], ['dash-weather', 'Weather'], ...(demo ? [['dash-sms', 'SMS demo']] : []), ['dash-stocking', 'Stocking records']] : []), ...(ready ? [['dash-alerts', 'Alerts & assessments']] : [])];
  const [active, setActive] = useState('dash-overview');
  const ids = items.map(item => item[0]).join(',');
  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        let current = 'dash-overview';
        for (const id of ids.split(',')) {
          const element = document.getElementById(id);
          if (element && element.getBoundingClientRect().top <= 180) current = id;
        }
        setActive(current);
      });
    };
    update(); window.addEventListener('scroll', update, { passive: true });
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', update); };
  }, [ids]);
  return <aside className="dash-sidebar"><nav aria-label="Dashboard sections"><p className="eyebrow">ON THIS PAGE</p>{items.map(([id, label], i) => <button key={id} type="button" aria-current={active === id ? 'location' : undefined} onClick={() => {
    const section = document.getElementById(id!);
    if (!section) return;
    section.focus({ preventScroll: true });
    section.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
    setActive(id!);
  }}><span aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>{label}</button>)}</nav></aside>;
}
