import { afterEach, describe, expect, it, vi } from 'vitest';

import { createOutreach, getMember, updateMemberAssignment } from './members';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('members API client', () => {
  it('sends authenticated typed outreach and assignment requests', async () => {
    const fetchMock = vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 4, outreach_key: 'OUT-4', channel: 'SMS', outcome: 'left message', occurred_at: '2025-01-01T12:00:00Z', notes: 'Called' }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 1 }), { status: 200 }));

    await createOutreach('token', 8, {
      channel: 'SMS',
      outcome: 'left message',
      occurred_at: '2025-01-01T12:00:00.000Z',
      notes: 'Called',
    });
    await updateMemberAssignment('token', 8, null);

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/v1/members/8/outreach', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ channel: 'SMS', outcome: 'left message', occurred_at: '2025-01-01T12:00:00.000Z', notes: 'Called' }),
      headers: expect.objectContaining({ Authorization: 'Bearer token' }),
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/v1/members/8/assignment', expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({ coordinator_id: null }),
    }));
  });

  it('surfaces API detail errors and network failures', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ detail: 'Member was not found' }), { status: 404 }));
    await expect(getMember('token', '404')).rejects.toThrow('Member was not found');

    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(getMember('token', '1')).rejects.toThrow('Failed to fetch');
  });
});
