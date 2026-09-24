// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ getSession: vi.fn(), signUp: vi.fn(), signInWithPassword: vi.fn(), me: vi.fn(), request: vi.fn() }));
vi.mock('./lib/supabase', () => ({
  supabase: { auth: { ...mock, onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) } },
  api: { me: mock.me, request: mock.request },
}));
import Register from './Register';
// Address loading is tested separately; these tests cover account submission.
vi.mock('./components/AddressFields', () => ({ default: ({ value, onChange }: { value: Record<string, string>; onChange: (value: Record<string, string>) => void }) => <>{Object.entries({ region: 'Region', province: 'Province', municipalityCity: 'City / Municipality', barangay: 'Barangay' }).map(([field, label]) => <label key={field}>{label}<input name={field} required value={value[field]} onChange={event => onChange({ ...value, [field]: event.target.value })} /></label>)}</> }));

beforeEach(() => {
  vi.clearAllMocks();
  mock.getSession.mockResolvedValue({ data: { session: null }, error: null });
  mock.me.mockResolvedValue({ data: { operator: null } });
  mock.request.mockResolvedValue({ data: [{ code: 'en', name: 'English', nativeName: 'English' }] });
  window.matchMedia = vi.fn().mockReturnValue({ matches: false });
});
afterEach(cleanup);

async function accountForm() {
  render(<Register login={false} />);
  const email = await screen.findByLabelText('Email address');
  fireEvent.change(email, { target: { value: 'test@example.com' } });
  for (const [label, value] of Object.entries({ 'Mobile number': '09171234567', Region: 'XI', Province: 'Davao del Sur', 'City / Municipality': 'Davao City', Barangay: 'Test barangay' })) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  }
  fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: 'Test-password123' } });
  fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'Test-password123' } });
}

describe('registration', () => {
  it.each(['9945568789', '099455687890', '+639945568789', '09945abc789', '19945568789'])('rejects invalid local number %s before signup', async (number) => {
    await accountForm();
    fireEvent.change(screen.getByLabelText('Mobile number'), { target: { value: number } });
    fireEvent.submit(screen.getByLabelText('Mobile number').closest('form')!);
    expect((await screen.findByRole('alert')).textContent).toContain('11 digits starting with 0');
    expect(mock.signUp).not.toHaveBeenCalled();
  });
  it('rejects mismatched passwords before calling Supabase', async () => {
    await accountForm();
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'different123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create account →' }));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('do not match'));
    expect(mock.signUp).not.toHaveBeenCalled();
  });

  it('waits for email confirmation without creating an unauthenticated profile', async () => {
    mock.signUp.mockResolvedValue({ data: { session: null }, error: null });
    await accountForm();
    fireEvent.click(screen.getByRole('button', { name: 'Create account →' }));
    expect(await screen.findByRole('heading', { name: 'Check your inbox.' })).toBeTruthy();
    expect(mock.request).not.toHaveBeenCalled();
    expect(mock.signUp.mock.calls[0][0]).not.toHaveProperty('confirmPassword');
    expect(mock.signUp.mock.calls[0][0].options.data.registrationContact).toEqual({ mobileNumber: '09171234567', region: 'XI', province: 'Davao del Sur', municipalityCity: 'Davao City', barangay: 'Test barangay' });
  });

  it('resumes a verified user and sends exactly the operator fields with consent off', async () => {
    mock.getSession.mockResolvedValue({ data: { session: { access_token: 'test-only', user: { user_metadata: { registrationContact: { mobileNumber: '+639171234567', region: 'XI', province: 'Davao del Sur', municipalityCity: 'Davao City', barangay: 'Test barangay' } } } } }, error: null });
    render(<Register login={false} />);
    await screen.findByRole('heading', { name: 'Tell us about you.' });
    await screen.findByRole('option', { name: 'English' });
    expect((screen.getByLabelText('Mobile number') as HTMLInputElement).value).toBe('09171234567');
    expect((screen.getByLabelText('Barangay') as HTMLInputElement).value).toBe('Test barangay');
    for (const [label, value] of Object.entries({ 'First name': 'Test', 'Last name': 'Operator', 'Mobile number': '09171234567', Region: 'XI', Province: 'Davao del Sur', 'City / Municipality': 'Davao City', Barangay: 'Test barangay' })) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    }
    fireEvent.change(screen.getByLabelText('Preferred language'), { target: { value: 'en' } });
    fireEvent.click(screen.getByRole('button', { name: 'Complete registration →' }));
    await screen.findByRole('heading', { name: 'You’re all set.' });
    expect(mock.request).toHaveBeenCalledWith('/farmers', { method: 'POST', body: {
      firstName: 'Test', lastName: 'Operator', mobileNumber: '+639171234567', region: 'XI', province: 'Davao del Sur', municipalityCity: 'Davao City', barangay: 'Test barangay', preferredLanguageCode: 'en', smsConsent: false,
    } });
  });

  it('retains profile inputs when the backend fails and allows retry', async () => {
    mock.getSession.mockResolvedValue({ data: { session: {} }, error: null });
    mock.request.mockImplementation(async (path: string) => {
      if (path.startsWith('/languages')) return { data: [{ code: 'en', nativeName: 'English' }] };
      throw new Error('Connection interrupted');
    });
    const { container } = render(<Register login={false} />);
    const first = await screen.findByLabelText('First name');
    fireEvent.change(first, { target: { value: 'Retained' } });
    fireEvent.change(screen.getByLabelText('Mobile number'), { target: { value: '09945568789' } });
    fireEvent.submit(container.querySelector('form')!);
    await screen.findByRole('alert');
    expect((first as HTMLInputElement).value).toBe('Retained');
    expect(screen.queryByRole('heading', { name: 'You’re all set.' })).toBeNull();
  });

  it('toggles fish following and releases it with Escape', async () => {
    render(<Register login={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Make fish follow cursor' }));
    expect(screen.getByRole('button', { name: 'Stop fish following cursor' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Make fish follow cursor' }).getAttribute('aria-pressed')).toBe('false'));
  });
});
