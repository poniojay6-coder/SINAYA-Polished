import { useEffect, useRef, useState } from 'react';
import SwimmingFish from './SwimmingFish';

export default function CompanionFish() {
  const [following, setFollowing] = useState(false);
  const [paused, setPaused] = useState(false);
  const fish = useRef<HTMLButtonElement>(null);
  const pose = useRef<HTMLSpanElement>(null);
  const motion = useRef({ x: 80, y: Math.max(80, window.innerHeight - 170), vx: 0, vy: 0, angle: 0, time: 0 });
  const pointer = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  useEffect(() => {
    const element = fish.current;
    const artwork = pose.current;
    if (!element || !artwork) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let previous = 0;
    const move = (event: PointerEvent) => { pointer.current = { x: event.clientX, y: event.clientY }; };
    const stop = (event: KeyboardEvent) => { if (event.key === 'Escape') setFollowing(false); };
    const animate = (now: number) => {
      const dt = previous ? Math.min((now - previous) / 1000, 0.04) : 1 / 60;
      previous = now;
      const state = motion.current;
      if (!paused && !reduced.matches) {
        state.time += dt;
        const t = state.time;
        // Small figure-eight flourishes near the cursor; a slow patrol when released.
        const targetX = following ? pointer.current.x - 90 + Math.sin(t * 1.5) * 22 : window.innerWidth / 2 + Math.sin(t * 0.23) * Math.max(0, window.innerWidth / 2 - 95);
        const targetY = following ? pointer.current.y + 65 + Math.sin(t * 3) * 10 : window.innerHeight - 150 + Math.sin(t * 0.7) * 24;
        const x = Math.max(65, Math.min(window.innerWidth - 65, targetX));
        const y = Math.max(45, Math.min(window.innerHeight - 125, targetY));
        // Time-based damped spring preserves position and momentum when toggled.
        state.vx += ((x - state.x) * 13 - state.vx * 7) * dt;
        state.vy += ((y - state.y) * 13 - state.vy * 7) * dt;
        const speed = Math.hypot(state.vx, state.vy);
        if (speed > 650) { state.vx *= 650 / speed; state.vy *= 650 / speed; }
        state.x += state.vx * dt;
        state.y += state.vy * dt;
        if (speed > 8) {
          const desired = Math.atan2(state.vy, state.vx);
          const difference = Math.atan2(Math.sin(desired - state.angle), Math.cos(desired - state.angle));
          state.angle += difference * (1 - Math.exp(-5 * dt));
        }
        artwork.style.transform = `rotate(${state.angle}rad) scaleY(${Math.cos(state.angle) < 0 ? -1 : 1})`;
        element.style.setProperty('--tail-speed', `${Math.max(230, 750 - speed)}ms`);
      }
      element.style.transform = `translate3d(${state.x - 60}px, ${state.y - 30}px, 0)`;
      frame = requestAnimationFrame(animate);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('keydown', stop);
    frame = requestAnimationFrame(animate);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('pointermove', move); window.removeEventListener('keydown', stop); };
  }, [following, paused]);
  return <div className={`companion ${following ? 'is-following' : ''} ${paused ? 'motion-paused' : ''}`}>
    <button ref={fish} type="button" className="companion-fish" aria-label={following ? 'Stop fish following cursor' : 'Make fish follow cursor'} aria-pressed={following} onClick={() => setFollowing(!following)}><span ref={pose} className="companion-pose"><SwimmingFish /></span></button>
    <div className="companion-controls"><span>{following ? 'Your pond companion · Esc to release' : 'Meet your pond companion · Click the fish'}</span><button type="button" onClick={() => setFollowing(!following)}>{following ? 'Release fish' : 'Follow cursor'}</button><button type="button" aria-pressed={paused} onClick={() => setPaused(!paused)}>{paused ? 'Play' : 'Pause'}</button></div>
  </div>;
}
