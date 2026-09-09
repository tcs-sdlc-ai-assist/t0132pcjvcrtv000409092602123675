import React, { useState } from 'react';

import type { OutreachCreatePayload } from '../types';

interface CareActionsProps {
  openGapId: number | undefined;
  onCloseGap: (reason: string) => Promise<void>;
  onOutreach: (payload: OutreachCreatePayload) => Promise<void>;
}

function currentLocalDateTime(): string {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

/** Offer labelled close-gap and outreach documentation forms. */
export function CareActions({ openGapId, onCloseGap, onOutreach }: CareActionsProps): React.JSX.Element {
  const [reason, setReason] = useState('');
  const [outreachDate, setOutreachDate] = useState(currentLocalDateTime);
  const [channel, setChannel] = useState<OutreachCreatePayload['channel']>('phone');
  const [outcome, setOutcome] = useState<OutreachCreatePayload['outcome']>('reached');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submitGap = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!openGapId || !reason.trim()) {
      setError('A closure reason is required.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      await onCloseGap(reason.trim());
      setReason('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to close gap.');
    } finally {
      setBusy(false);
    }
  };

  const submitOutreach = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!outreachDate) {
      setError('Outreach date and time are required.');
      return;
    }
    if (!notes.trim()) {
      setError('Outreach notes are required.');
      return;
    }

    const occurredAt = new Date(outreachDate);
    if (Number.isNaN(occurredAt.getTime())) {
      setError('Outreach date and time are invalid.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      await onOutreach({
        channel,
        outcome,
        occurred_at: occurredAt.toISOString(),
        notes: notes.trim(),
      });
      setNotes('');
      setOutreachDate(currentLocalDateTime());
      setChannel('phone');
      setOutcome('reached');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save outreach.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label="Care work actions" className="care-actions">
      <h2>Document care work</h2>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <form onSubmit={submitGap}>
        <label htmlFor="closure-reason">Closure reason</label>
        <input
          aria-required="true"
          id="closure-reason"
          onChange={(event) => setReason(event.target.value)}
          value={reason}
        />
        <button disabled={busy || !openGapId} type="submit">
          Close gap
        </button>
      </form>
      <form onSubmit={submitOutreach}>
        <label htmlFor="outreach-date">Outreach date and time</label>
        <input
          aria-required="true"
          id="outreach-date"
          onChange={(event) => setOutreachDate(event.target.value)}
          type="datetime-local"
          value={outreachDate}
        />
        <label htmlFor="outreach-channel">Channel</label>
        <select
          aria-required="true"
          id="outreach-channel"
          onChange={(event) => setChannel(event.target.value as OutreachCreatePayload['channel'])}
          value={channel}
        >
          <option value="phone">phone</option>
          <option value="SMS">SMS</option>
          <option value="mail">mail</option>
          <option value="member portal">member portal</option>
        </select>
        <label htmlFor="outreach-outcome">Outcome</label>
        <select
          aria-required="true"
          id="outreach-outcome"
          onChange={(event) => setOutcome(event.target.value as OutreachCreatePayload['outcome'])}
          value={outcome}
        >
          <option value="reached">reached</option>
          <option value="left message">left message</option>
          <option value="no answer">no answer</option>
          <option value="wrong number">wrong number</option>
        </select>
        <label htmlFor="outreach-notes">Outreach notes</label>
        <textarea
          aria-required="true"
          id="outreach-notes"
          onChange={(event) => setNotes(event.target.value)}
          value={notes}
        />
        <button disabled={busy} type="submit">
          Log outreach
        </button>
      </form>
    </section>
  );
}
