import SiteFooter from './components/SiteFooter';
import { demoMode } from './lib/demo';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { api, supabase } from './lib/supabase';
import { ApiError } from './lib/api';
import CompanionFish from './components/CompanionFish';
import AddressFields from './components/AddressFields';
import './Register.css';

const contactFields = ['mobileNumber', 'region', 'province', 'municipalityCity', 'barangay'] as const;
type Contact = Record<typeof contactFields[number], string>;
const emptyContact: Contact = { mobileNumber: '', region: '', province: '', municipalityCity: '', barangay: '' };

type Language = { code: string; name: string; nativeName: string };
export default function Register({ login }: { login: boolean }) {
  const [stage, setStage] = useState<'account' | 'verify' | 'profile' | 'done'>('account');
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(Boolean(supabase) && !demoMode);
  const [error, setError] = useState('');
  const [languages, setLanguages] = useState<Language[]>([]);
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [contact, setContact] = useState<Contact>(emptyContact);
  const heading = useRef<HTMLHeadingElement>(null);

  async function loadProfile() {
    const { data } = await api.me();
    if (data.operator) { setStage('done'); return; }
    setStage('profile');
    const result = await api.request<Language[]>('/languages?limit=100');
    setLanguages(result.data);
  }

  useEffect(() => {
    let active = true;
    if (!supabase || demoMode) return;
    const client = supabase;
    async function restore() {
      try {
        const { data, error: sessionError } = await client.auth.getSession();
        if (sessionError) throw sessionError;
        if (window.location.search) window.history.replaceState(null, '', '/#register');
        if (active && data.session) {
          const saved = data.session.user?.user_metadata?.registrationContact;
          if (saved && typeof saved === 'object') setContact(Object.fromEntries(contactFields.map(field => [field, typeof saved[field] === 'string' ? (field === 'mobileNumber' ? saved[field].replace(/^\+63/, '0') : saved[field]) : ''])) as Contact);
          await loadProfile();
        }
      } catch { if (active) setError('We could not load your account. Check that the backend is running, then retry.'); }
      finally { if (active) setChecking(false); }
    }
    void restore();
    const { data: subscription } = client.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') setTimeout(() => { if (active) void restore(); }, 0);
    });
    return () => { active = false; subscription.subscription.unsubscribe(); };
  }, []);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [stage, login]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || (!supabase && !demoMode)) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    setError('');
    const password = String(values.get('password') ?? '');
    if (stage === 'account' && !login && password !== values.get('confirmPassword')) { setError('Your passwords do not match. Please check both fields.'); return; }
    if ((stage === 'profile' || !login) && !/^0[0-9]{10}$/.test(contact.mobileNumber)) { setError('Enter exactly 11 digits starting with 0, for example 09945568789.'); return; }
    setBusy(true);
    try {
      if (stage === 'profile') {
        const body: Record<string, unknown> = {};
        for (const field of ['firstName', 'lastName', 'mobileNumber', 'region', 'province', 'municipalityCity', 'barangay', 'preferredLanguageCode']) body[field] = String(values.get(field) ?? '').trim();
        body.mobileNumber = '+63' + contact.mobileNumber.slice(1);
        body.smsConsent = values.get('smsConsent') === 'on';
        const latitude = String(values.get('latitude') ?? '');
        const longitude = String(values.get('longitude') ?? '');
        if (Boolean(latitude) !== Boolean(longitude)) throw new Error('Enter both coordinates, or leave both blank.');
        if (latitude && longitude) { body.latitude = Number(latitude); body.longitude = Number(longitude); }
        try { await api.request('/farmers', { method: 'POST', body }); }
        catch (failure) {
          // A lost response may leave an already-created profile. Check before retrying.
          if (!(failure instanceof ApiError) || failure.status !== 409 || !(await api.me()).data.operator) throw failure;
        }
        setStage('done');
      } else {
        const address = String(values.get('email')).trim();
        setEmail(address);
        if (demoMode) {
          form.reset();
          if (login) setStage('done');
          else { setLanguages((await api.request<Language[]>('/languages')).data); setStage('profile'); }
        } else if (login && supabase) {
          const { error: authError } = await supabase.auth.signInWithPassword({ email: address, password });
          if (authError) throw authError;
          form.reset();
          await loadProfile();
        } else if (supabase) {
          const { data, error: authError } = await supabase.auth.signUp({ email: address, password, options: { data: { registrationContact: contact }, emailRedirectTo: `${window.location.origin}/?registration=1#register` } });
          if (authError) throw authError;
          form.reset();
          if (data.session) await loadProfile();
          else setStage('verify');
        }
      }
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to save. Please try again.'); }
    finally { setBusy(false); }
  }

  const contactInputs = <>
    <label>Mobile number<input name="mobileNumber" type="tel" autoComplete="tel" placeholder="09945568789" inputMode="numeric" minLength={11} maxLength={11} pattern="0[0-9]{10}" title="Enter exactly 11 digits starting with 0, for example 09945568789." required value={contact.mobileNumber} onChange={event => setContact({ ...contact, mobileNumber: event.target.value })} /></label>
    <p className="eyebrow">YOUR ADDRESS</p>
    <AddressFields value={contact} onChange={address => setContact(current => ({ ...current, ...address }))} />
  </>;
  const title = stage === 'profile' ? 'Tell us about you.' : stage === 'verify' ? 'Check your inbox.' : stage === 'done' ? 'You’re all set.' : login ? 'Welcome back.' : 'Start with your pond.';
  return <main className="registration-page">
    <div className="registration-shell">
      <header className="registration-header">
        <a href="#home" className="registration-back">← Back to home</a>
        
      {demoMode && <div className="demo-shortcut"><a className="button button-primary" href="#register-pond">Try demo <span aria-hidden="true">↗</span><small>No login needed</small></a><span>Register a pond and explore the dashboard</span></div>}</header>
      <div className="registration-layout">
        <aside className="registration-story"><p className="eyebrow">YOUR FARM. A CLEARER PICTURE.</p><h1>Good decisions <br />start <span>below <br />the surface.</span></h1><p>Get closer to your pond’s water conditions, understand the weather ahead, and keep your farm team informed.</p><div className="registration-benefit"><span>01</span><div><strong>Know each pond</strong><p>Oxygen, pH, and temperature in context.</p></div></div><div className="registration-benefit"><span>02</span><div><strong>Keep your team connected</strong><p>Guidance for operators and designated contacts.</p></div></div><p className="registration-prototype">SINAYA · Sensor Intelligence Network for Aquaculture Yield Analytics</p></aside>
        <section className="registration-card" aria-labelledby="registration-title">
          <p className="eyebrow">{stage === 'profile' ? '02 / OPERATOR DETAILS' : stage === 'done' ? 'WELCOME TO SINAYA' : '01 / ACCOUNT ACCESS'}</p>
          <h2 id="registration-title" ref={heading} tabIndex={-1}>{title}</h2>
          <p>{stage === 'profile' ? 'Set up your operator profile. You can add your farms and ponds separately.' : stage === 'verify' ? `If registration is available for ${email}, you’ll receive a confirmation email. Open the link, then return here to finish your operator profile.` : stage === 'done' ? 'Your account and operator profile are saved. Register your farm and pond to continue.' : login ? 'Sign in to continue setting up your farm profile.' : 'Create your account, then introduce yourself as a farm operator.'}</p>
          {!supabase && !demoMode && <p role="alert" className="form-message">Account access is not configured yet. Add the public Supabase URL and key to the frontend environment.</p>}
          {checking && <p role="status">Checking your session…</p>}
          {error && <div role="alert" className="form-message">{error}<button type="button" onClick={() => { setError(''); window.location.reload(); }}>Reload account</button></div>}
          {!checking && (stage === 'account' || stage === 'profile') && <form onSubmit={submit}>
            <fieldset disabled={busy}>
              {stage === 'account' ? <>
                <label>Email address<input name="email" type="email" autoComplete="email" placeholder="you@example.com" required maxLength={254} /></label>
                {!login && contactInputs}
                <label>Password<div className="password-field"><input name="password" type={visible ? 'text' : 'password'} autoComplete={login ? 'current-password' : 'new-password'} minLength={login ? undefined : 8} required aria-describedby={!login ? 'password-help' : undefined} /><button type="button" onClick={() => setVisible(!visible)} aria-label={visible ? 'Hide passwords' : 'Show passwords'}>{visible ? 'Hide' : 'Show'}</button></div></label>
                {!login && <><small id="password-help">Use at least 8 characters.</small><label>Confirm password<input name="confirmPassword" type={visible ? 'text' : 'password'} autoComplete="new-password" minLength={8} required /></label></>}
              </> : <>
                <div className="form-pair"><label>First name<input name="firstName" autoComplete="given-name" required maxLength={200} /></label><label>Last name<input name="lastName" autoComplete="family-name" required maxLength={200} /></label></div>
                {contactInputs}
                <label>Preferred language<select name="preferredLanguageCode" required defaultValue=""><option value="" disabled>Select your language</option>{languages.map(language => <option key={language.code} value={language.code}>{language.nativeName || language.name}</option>)}</select></label>
                <details><summary>Location coordinates <span>(optional)</span></summary><div className="form-pair"><label>Latitude<input type="number" name="latitude" min="-90" max="90" step="any" /></label><label>Longitude<input type="number" name="longitude" min="-180" max="180" step="any" /></label></div></details>
                <label className="consent-field"><input name="smsConsent" type="checkbox" /><span>I agree to receive pond alerts by SMS. <small>Optional. Messages are currently simulated.</small></span></label>
              </>}
              <button className="button button-primary register-submit" type="submit" disabled={(!supabase && !demoMode) || (stage === 'profile' && !languages.length)}>{busy ? 'Saving…' : stage === 'profile' ? 'Complete registration →' : login ? 'Sign in →' : 'Create account →'}</button>
            </fieldset>
          </form>}
          {stage === 'verify' && <a className="button button-primary register-submit" href="#login" onClick={() => setStage('account')}>I’ve confirmed my email · Sign in</a>}
          {stage === 'done' && <><a href="#register-pond" className="button button-primary register-submit">Register your pond →</a><button className="registration-signout" onClick={async () => { const result = demoMode ? null : await supabase?.auth.signOut(); if (result?.error) { setError(result.error.message); return; } setStage('account'); }}>Sign out</button></>}
          {stage === 'account' && <p className="registration-switch">{login ? 'New to SINAYA?' : 'Already have an account?'} <a href={login ? '#register' : '#login'} onClick={() => setError('')}>{login ? 'Create an account' : 'Sign in'}</a></p>}
          <p className="registration-footnote">Built for Philippine fish and shrimp farms.</p>
        </section>
      </div>
    </div>
    <SiteFooter /><CompanionFish />
  </main>;
}



