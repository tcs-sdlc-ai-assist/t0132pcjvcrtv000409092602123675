import React, { useCallback, useEffect, useState } from 'react';

import { getDashboard } from '../api/dashboard';
import { useAuth } from '../auth/AuthContext';
import { DashboardView } from '../components/DashboardView';
import type { Dashboard } from '../types';

/** Fetch and display the signed-in staff member's scoped dashboard. */
export default function DashboardPage(): React.JSX.Element {
  const { session } = useAuth();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (): Promise<void> => {
    if (!session) {
      return;
    }
    setLoading(true);
    setError('');
    try {
      setDashboard(await getDashboard(session.access_token));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The dashboard could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Care coordination</p>
          <h1>Dashboard</h1>
          <p className="intro">A scoped view of panel workload, outreach, and priority follow-up.</p>
        </div>
      </header>
      <DashboardView dashboard={dashboard} error={error} loading={loading} onRetry={() => void load()} />
    </>
  );
}
