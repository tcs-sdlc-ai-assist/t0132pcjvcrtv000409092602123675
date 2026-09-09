import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import PanelPage from './PanelPage';

const { getMembers } = vi.hoisted(() => ({ getMembers: vi.fn() }));
vi.mock('../api/members', () => ({ getMembers }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ session: { access_token: 'token', role: 'coordinator', name: 'Care' }, logout: vi.fn() }) }));

/** Render the panel page with router support. */
function renderPage(): void { render(<MemoryRouter><PanelPage /></MemoryRouter>); }

describe('PanelPage', () => {
  it('renders member data and sends URL-backed filter requests', async () => { getMembers.mockResolvedValue({ items: [{ id: 1, member_key: 'MEM-1', first_name: 'Ada', last_name: 'Lovelace', date_of_birth: '1980-01-01', risk_level: 'high', plan: 'Meridian Choice', assigned_coordinator_id: 1, open_gap_count: 2 }], total: 1, limit: 10, offset: 0 }); renderPage(); expect(await screen.findByText('Lovelace, Ada')).toBeTruthy(); fireEvent.change(screen.getByLabelText('Search members'), { target: { value: 'Ada' } }); await waitFor(() => expect(getMembers.mock.calls.length).toBeGreaterThan(1)); });
  it('distinguishes an empty assigned panel', async () => { getMembers.mockResolvedValue({ items: [], total: 0, limit: 10, offset: 0 }); renderPage(); expect(await screen.findByText('No members are assigned to your panel.')).toBeTruthy(); });
  it('presents retryable errors', async () => { getMembers.mockRejectedValue(new Error('Network unavailable')); renderPage(); expect(await screen.findByText(/We could not load members/)).toBeTruthy(); expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy(); });
});