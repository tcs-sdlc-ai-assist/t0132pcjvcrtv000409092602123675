import React, { useState } from 'react';

interface CareActionsProps {
  openGapId: number | undefined;
  onCloseGap: (reason: string) => Promise<void>;
  onOutreach: (payload: { channel: string; outcome: string; occurred_at: string; notes: string }) => Promise<void>;
}

/** Offer labelled close-gap and outreach documentation forms. */
export function CareActions({ openGapId, onCloseGap, onOutreach }: CareActionsProps): React.JSX.Element {
  const [reason, setReason] = useState(''); const [notes, setNotes] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const submitGap = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => { event.preventDefault(); if (!openGapId || !reason.trim()) { setError('A closure reason is required.'); return; } setBusy(true); setError(''); try { await onCloseGap(reason); setReason(''); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to close gap.'); } finally { setBusy(false); } };
  const submitOutreach = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => { event.preventDefault(); if (!notes.trim()) { setError('Outreach notes are required.'); return; } setBusy(true); setError(''); try { await onOutreach({ channel: 'phone', outcome: 'reached', occurred_at: new Date().toISOString(), notes }); setNotes(''); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to save outreach.'); } finally { setBusy(false); } };
  return <section className="care-actions" aria-label="Care work actions"><h2>Document care work</h2>{error && <p className="form-error" role="alert">{error}</p>}<form onSubmit={submitGap}><label htmlFor="closure-reason">Closure reason</label><input id="closure-reason" value={reason} onChange={(event) => setReason(event.target.value)} aria-required="true" /><button disabled={busy || !openGapId} type="submit">Close gap</button></form><form onSubmit={submitOutreach}><label htmlFor="outreach-notes">Outreach notes</label><textarea id="outreach-notes" value={notes} onChange={(event) => setNotes(event.target.value)} aria-required="true" /><button disabled={busy} type="submit">Log outreach</button></form></section>;
}