import React from 'react';
import { Link } from 'react-router-dom';

import type { PanelMember } from '../types';

interface PanelTableProps {
  members: PanelMember[];
  sortBy: string;
  sortOrder: string;
  onSort: (field: string) => void;
}

/** Render a sortable, accessible table for a member panel. */
export function PanelTable({ members, sortBy, sortOrder, onSort }: PanelTableProps): React.JSX.Element {
  const sortable = (field: string, label: string): React.JSX.Element => (
    <th
      aria-sort={sortBy === field ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
      scope="col"
    >
      <button className="table-sort" onClick={() => onSort(field)} type="button">
        {label}
      </button>
    </th>
  );

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {sortable('last_name', 'Member')}
            {sortable('date_of_birth', 'DOB')}
            {sortable('plan', 'Plan')}
            {sortable('pcp', 'PCP')}
            {sortable('risk_level', 'Risk')}
            {sortable('open_gap_count', 'Open gaps')}
            {sortable('last_outreach', 'Last outreach')}
            <th scope="col"><span className="sr-only">Open member</span></th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.id}>
              <td>
                <strong>{member.last_name}, {member.first_name}</strong>
                <span className="table-meta">{member.member_key}</span>
              </td>
              <td>{member.date_of_birth}</td>
              <td>{member.plan}</td>
              <td>{member.pcp}</td>
              <td><span className="status-badge">{member.risk_level}</span></td>
              <td className="numeric">{member.open_gap_count}</td>
              <td>{member.last_outreach_at ?? 'No outreach recorded'}</td>
              <td>
                <Link className="secondary-button table-action" to={`/members/${member.id}`}>
                  Open
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
