import { demoMode, demoRequest } from './demo';
export interface ApiResponse<T> {
  data: T;
  pagination?: { limit: number; offset: number };
}
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) { super(message); this.status = status; this.code = code; }
}
export interface Operator { id: string; firstName: string; lastName: string; preferredLanguageCode: string; smsConsent: boolean; accountStatus: string }
export interface Farm { id: string; operatorId: string; name: string; isActive: boolean }
export interface Pond { id: string; farmId: string; name: string; areaM2: string; waterType: string; latitude: string | null; longitude: string | null; isActive: boolean }
export interface Assessment { id: string; pondId: string; cycleId: string; source: 'device' | 'simulated'; status: 'review_required' | 'data_unavailable' | 'within_reviewed_ranges' | 'watch' | 'warning'; confidence: 'unavailable' | 'standard' | 'high' | 'limited'; reasons: string[]; snapshot: Record<string, unknown>; createdAt: string }
export interface Advisory { id: string; assessmentId: string; languageCode: string; status: 'ready' | 'review_required' | 'no_alert'; finalText: string | null; generatedText: string | null; generationStatus: 'not_requested' | 'draft' | 'unavailable' }
export interface Delivery { id: string; advisoryId: string; maskedPhone: string; message: string; status: 'delivered'; simulated: true }

// Pass a Supabase session token getter from the future auth UI. Never pass database credentials.
export function createApiClient(getAccessToken: () => Promise<string | null>, baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:3030') {
  async function request<T>(path: string, options: { method?: 'GET' | 'POST' | 'PATCH'; body?: unknown; signal?: AbortSignal } = {}): Promise<ApiResponse<T>> {
    if (demoMode) return demoRequest<T>(path, options);
    const token = await getAccessToken();
    if (!token) throw new ApiError(401, 'UNAUTHORIZED', 'Sign in to continue.');
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api${path}`, {
      method: options.method ?? 'GET', headers: { Authorization: `Bearer ${token}`, ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: options.body === undefined ? undefined : JSON.stringify(options.body), signal: options.signal ?? AbortSignal.timeout(30000),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new ApiError(response.status, payload?.error?.code ?? 'REQUEST_FAILED', payload?.error?.message ?? 'Request failed.');
    if (!payload || !('data' in payload)) throw new ApiError(502, 'INVALID_RESPONSE', 'Unexpected backend response.');
    return payload as ApiResponse<T>;
  }
  const segment = (value: string) => encodeURIComponent(value);
  const assessmentPath = (pondId: string, assessmentId: string) => `/ponds/${segment(pondId)}/assessments/${segment(assessmentId)}`;
  return {
    request,
    me: () => request<{ userId: string; operator: Operator | null }>('/auth/me'),
    farms: (offset = 0) => request<Farm[]>(`/farms?limit=25&offset=${offset}`),
    ponds: (farmId: string, offset = 0) => request<Pond[]>(`/ponds?farmId=${segment(farmId)}&limit=25&offset=${offset}`),
    assess: (pondId: string, cycleId: string, source: 'device' | 'simulated' = 'device', availableEquipmentIds: string[] = []) => request<Assessment>(`/ponds/${segment(pondId)}/assessments`, { method: 'POST', body: { cycleId, source, availableEquipmentIds } }),
    assessments: (pondId: string, offset = 0) => request<Assessment[]>(`/ponds/${segment(pondId)}/assessments?limit=25&offset=${offset}`),
    createAdvisory: (pondId: string, assessmentId: string, languageCode: string) => request<Advisory>(`${assessmentPath(pondId, assessmentId)}/advisories`, { method: 'POST', body: { languageCode } }),
    simulate: (pondId: string, assessmentId: string, advisoryId: string) => request<{ simulated: true; eligibleRecipients: number; deliveries: Delivery[] }>(`${assessmentPath(pondId, assessmentId)}/advisories/${segment(advisoryId)}/simulate`, { method: 'POST', body: {} }),
  };
}
