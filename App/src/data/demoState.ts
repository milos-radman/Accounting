import type { AppData } from '../types';

export async function loadDemoState(): Promise<AppData | null> {
  const response = await fetch(`${import.meta.env.BASE_URL}demo/state`);
  if (response.status === 204) return null;
  if (!response.ok) throw new Error(`Could not load demo data (${response.status}).`);
  return response.json() as Promise<AppData>;
}

export async function saveDemoState(data: AppData): Promise<void> {
  const response = await fetch(`${import.meta.env.BASE_URL}demo/state`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error(`Could not save demo data (${response.status}).`);
}
