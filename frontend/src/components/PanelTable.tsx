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
    <th scope="col" aria-sort={sortBy === field ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button className="table-sort" type="button" onClick={() => onSort(field)}>{label}</button>
    </th>
  );
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {sortable('last_name', 'Member')}
            {sortable('risk_level', 'Risk')}
            {sortable('plan', 'Plan')}
            <th scope="col">Open gaps</th>
            <th scope="col"><span className="sr-only">Open member</span></th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.id}>
              <td><strong>{member.last_name}, {member.first_name}</strong><span className="table-meta">{member.member_key} · DOB {member.date_of_birth}</span></td>
              <td><span className="status-badge">{member.risk_level}</span></td>
              <td>{member.plan}</td>
              <td className="numeric">{member.open_gap_count}</td>
              <td><Link className="secondary-button table-action" to={`/members/${member.id}`}>Open</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}