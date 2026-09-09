import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';
import { getMembers } from '../api/members';
import { PanelTable } from '../components/PanelTable';
import type { MemberPanel } from '../types';

/** Render the URL-backed, scoped search and filter member panel. */
export default function PanelPage(): React.JSX.Element {
  const { session } = useAuth();
  const [params, setParams] = useSearchParams();
  const [panel, setPanel] = useState<MemberPanel | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async (): Promise<void> => {
    if (!session) {
      return;
    }

    setLoading(true);
    setError('');
    try {
      setPanel(await getMembers(session.access_token, params));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load members.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [session, params.toString()]);

  const update = (key: string, value: string, resetOffset = true): void => {
    const next = new URLSearchParams(params);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    if (resetOffset) {
      next.set('offset', '0');
    }
    setParams(next);
  };

  const onSort = (field: string): void => {
    const next = new URLSearchParams(params);
    const usesLocalGapSort = field === 'open_gap_count';
    const currentField = usesLocalGapSort ? next.get('local_sort_by') : next.get('sort_by');
    const currentOrder = usesLocalGapSort ? next.get('local_sort_order') : next.get('sort_order');
    const nextOrder = currentField === field && currentOrder === 'asc' ? 'desc' : 'asc';

    if (usesLocalGapSort) {
      next.delete('sort_by');
      next.delete('sort_order');
      next.set('local_sort_by', field);
      next.set('local_sort_order', nextOrder);
    } else {
      next.delete('local_sort_by');
      next.delete('local_sort_order');
      next.set('sort_by', field);
      next.set('sort_order', nextOrder);
    }
    next.set('offset', '0');
    setParams(next);
  };

  const offset = Number(params.get('offset') ?? '0');
  const limit = Number(params.get('limit') ?? '10');
  const minimumOpenGaps = Number(params.get('open_gap_min') ?? '0');
  const localGapSort = params.get('local_sort_by') === 'open_gap_count';
  const localGapOrder = params.get('local_sort_order') ?? 'asc';
  const displayedMembers = [...(panel?.items ?? [])]
    .filter((member) => member.open_gap_count >= minimumOpenGaps)
    .sort((left, right) => (
      localGapSort
        ? (localGapOrder === 'asc' ? left.open_gap_count - right.open_gap_count : right.open_gap_count - left.open_gap_count)
        : 0
    ));
  const activeSortBy = localGapSort ? 'open_gap_count' : (params.get('sort_by') ?? 'last_name');
  const activeSortOrder = localGapSort ? localGapOrder : (params.get('sort_order') ?? 'asc');
  const hasActiveFilters = Boolean(
    params.get('query')
    || params.get('risk_level')
    || params.get('plan')
    || params.get('coordinator_id')
    || Number(params.get('open_gap_min') ?? '0') > 0,
  );

  return (
    <section className="workspace">
      <header className="workspace-header">
        <div>
          <p className="eyebrow">Care coordination</p>
          <h1>Member panel</h1>
        </div>
      </header>
      <section aria-label="Panel controls" className="panel-controls">
        <label>
          Search members
          <input
            onChange={(event) => update('query', event.target.value)}
            value={params.get('query') ?? ''}
          />
        </label>
        <label>
          Risk
          <select
            onChange={(event) => update('risk_level', event.target.value)}
            value={params.get('risk_level') ?? ''}
          >
            <option value="">All risk levels</option>
            <option value="high">High</option>
            <option value="moderate">Moderate</option>
          </select>
        </label>
        <label>
          Plan
          <select onChange={(event) => update('plan', event.target.value)} value={params.get('plan') ?? ''}>
            <option value="">All plans</option>
            <option value="Meridian Advantage">Meridian Advantage</option>
            <option value="Meridian Choice">Meridian Choice</option>
          </select>
        </label>
        {session?.role !== 'coordinator' && (
          <label>
            Coordinator ID
            <input
              inputMode="numeric"
              onChange={(event) => update('coordinator_id', event.target.value)}
              value={params.get('coordinator_id') ?? ''}
            />
          </label>
        )}
        <label>
          Minimum open gaps (current page)
          <select
            onChange={(event) => update('open_gap_min', event.target.value)}
            value={params.get('open_gap_min') ?? '0'}
          >
            <option value="0">All members</option>
            <option value="1">1 or more</option>
            <option value="2">2 or more</option>
            <option value="3">3 or more</option>
          </select>
        </label>
      </section>
      {loading && (
        <p aria-live="polite" className="state-message">
          Loading member panel…
        </p>
      )}
      {error && (
        <section className="state-message" role="alert">
          <p>We could not load members. {error}</p>
          <button onClick={() => void load()} type="button">Retry</button>
        </section>
      )}
      {!loading && !error && panel?.total === 0 && (
        <section className="state-message">
          <p>{hasActiveFilters ? 'No members match these filters.' : 'No members are assigned to your panel.'}</p>
          {hasActiveFilters && (
            <button onClick={() => setParams(new URLSearchParams())} type="button">Clear filters</button>
          )}
        </section>
      )}
      {!loading && !error && panel && panel.total > 0 && displayedMembers.length === 0 && (
        <section className="state-message">
          <p>{minimumOpenGaps > 0 ? 'No members on this page meet the minimum open-gap filter.' : 'No members match these filters.'}</p>
          <button onClick={() => setParams(new URLSearchParams())} type="button">Clear filters</button>
        </section>
      )}
      {!loading && !error && panel && displayedMembers.length > 0 && (
        <>
          <PanelTable
            members={displayedMembers}
            onSort={onSort}
            sortBy={activeSortBy}
            sortOrder={activeSortOrder}
          />
          <nav aria-label="Panel pagination" className="pagination">
            <button
              disabled={offset === 0}
              onClick={() => update('offset', String(Math.max(0, offset - limit)), false)}
              type="button"
            >
              Previous
            </button>
            <span>{offset + 1}–{Math.min(offset + limit, panel.total)} of {panel.total} server-filtered members</span>
            <button
              disabled={offset + limit >= panel.total}
              onClick={() => update('offset', String(offset + limit), false)}
              type="button"
            >
              Next
            </button>
          </nav>
        </>
      )}
    </section>
  );
}
