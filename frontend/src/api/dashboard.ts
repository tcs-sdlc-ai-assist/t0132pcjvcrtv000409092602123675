import type { Dashboard } from '../types';

/** Fetch the authenticated staff member's role-scoped dashboard payload. */
export async function getDashboard(token: string): Promise<Dashboard> {
  const response = await fetch(`${import.meta.env.VITE_API_URL ?? ''}/api/v1/dashboard`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ detail: 'The dashboard could not be loaded.' }));
    throw new Error(body.detail ?? 'The dashboard could not be loaded.');
  }

  return response.json() as Promise<Dashboard>;
}
