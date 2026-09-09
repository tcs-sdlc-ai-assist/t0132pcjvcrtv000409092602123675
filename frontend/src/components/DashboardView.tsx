import React from 'react';

import type { Dashboard } from '../types';

interface DashboardViewProps {
  dashboard: Dashboard | null;
  error: string;
  loading: boolean;
  onRetry: () => void;
}

function DashboardSkeleton(): React.JSX.Element {
  return (
    <div aria-label="Loading dashboard" className="dashboard-skeleton" role="status">
      <div className="skeleton-heading" />
      <div className="kpi-grid">
        {[0, 1, 2, 3, 4].map((item) => (
          <div className="kpi-card" key={item}>
            <div className="skeleton-line short" />
            <div className="skeleton-line large" />
          </div>
        ))}
      </div>
      <div className="dashboard-grid">
        <div className="skeleton-panel" />
        <div className="skeleton-panel" />
      </div>
    </div>
  );
}

/** Render the dashboard's loading, retryable error, and populated oversight states. */
export function DashboardView({ dashboard, error, loading, onRetry }: DashboardViewProps): React.JSX.Element {
  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <section className="state-message dashboard-error" role="alert">
        <h2>Dashboard unavailable</h2>
        <p>{error}</p>
        <button onClick={onRetry} type="button">
          Retry dashboard
        </button>
      </section>
    );
  }

  if (!dashboard) {
    return <section className="state-message">No dashboard data is available.</section>;
  }

  const measures = [
    ['Members assigned', dashboard.metrics.members_assigned],
    ['Open care gaps', dashboard.metrics.open_care_gaps],
    ['Outreach this week', dashboard.metrics.outreach_this_week],
    ['High-risk members', dashboard.metrics.high_risk_members],
    ['Gap-closure rate', `${dashboard.metrics.gap_closure_rate_percent}%`],
  ];
  const largest = Math.max(...dashboard.gaps_by_type.map((point) => point.count), 1);

  return (
    <div className="dashboard-stack">
      <section aria-label="Operational measures" className="kpi-grid">
        {measures.map(([label, value]) => (
          <article className="kpi-card" key={label}>
            <p>{label}</p>
            <strong>{value}</strong>
          </article>
        ))}
      </section>
      <section className="dashboard-grid">
        <article className="dashboard-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Open workload</p>
              <h2>Care gaps by type</h2>
            </div>
          </div>
          {dashboard.gaps_by_type.length > 0 ? (
            <svg aria-label="Open care gaps by type" className="gap-chart" role="img" viewBox="0 0 480 220">
              {dashboard.gaps_by_type.map((point, index) => {
                const width = 330 * (point.count / largest);
                const y = 20 + index * 48;
                return (
                  <g key={point.category}>
                    <text x="0" y={y + 16}>{point.category}</text>
                    <rect height="24" rx="3" width={width} x="138" y={y} />
                    <text className="chart-value" x={Math.min(475, 146 + width)} y={y + 17}>{point.count}</text>
                  </g>
                );
              })}
            </svg>
          ) : (
            <p className="empty-copy">No open care gaps in this scope.</p>
          )}
        </article>
        <article className="dashboard-panel">
          <p className="eyebrow">Priority follow-up</p>
          <h2>Attention needed</h2>
          {dashboard.attention_needed.length ? (
            <ul className="attention-list">
              {dashboard.attention_needed.map((member) => (
                <li key={member.member_id}>
                  <div>
                    <strong>{member.first_name} {member.last_name}</strong>
                    <span>{member.member_key}</span>
                  </div>
                  <span className="status-badge">{member.overdue_gap_count} overdue</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-copy">No high-risk members have overdue open gaps.</p>
          )}
        </article>
      </section>
      <section className="dashboard-panel activity-panel">
        <p className="eyebrow">Accountability</p>
        <h2>Recent audit activity</h2>
        {dashboard.recent_activity.length ? (
          <ul className="activity-list">
            {dashboard.recent_activity.map((activity, index) => (
              <li key={`${activity.created_at}-${index}`}>
                <strong>{activity.action.replaceAll('_', ' ')}</strong>
                <span>{activity.detail}</span>
                <time dateTime={activity.created_at}>{new Date(activity.created_at).toLocaleString()}</time>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-copy">No recent activity for this scope.</p>
        )}
      </section>
    </div>
  );
}
