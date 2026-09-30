import type { AppData } from '../types';

async function request(path: string, init?: RequestInit): Promise<Response> {
  const url = `${import.meta.env.BASE_URL}${path}`;
  try {
    const response = await fetch(url, init);
    if (response.ok || response.status === 204) return response;
    const payload = await response.json().catch(() => ({})) as { message?: string; diagnosticId?: string; details?: unknown };
    throw Object.assign(new Error(payload.message ?? `Request failed (${response.status}).`), {
      details: { url: new URL(url, location.href).href, status: response.status, ...payload },
    });
  } catch (error) {
    if (error instanceof Error && 'details' in error) throw error;
    throw Object.assign(new Error(error instanceof Error ? error.message : 'Network request failed.'), {
      details: { url: new URL(url, location.href).href, status: 'Network error' },
    });
  }
}

export async function loadDemoState(): Promise<AppData | null> {
  const response = await request('demo/state');
  if (response.status === 204) return null;
  return response.json() as Promise<AppData>;
}

export async function saveDemoState(data: AppData): Promise<void> {
  await request('demo/state', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}
