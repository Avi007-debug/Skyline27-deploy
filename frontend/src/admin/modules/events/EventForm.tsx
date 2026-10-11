import { ImagePlus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { ClubSelect } from '../../components/common/ClubSelect';
import { Modal } from '../../components/common/Modal';
import { Field, Spinner } from '../../components/common/ui';
import { errorMessage, post, put } from '../../services/http';
import type { EventRow } from '../../types/api';
import { fromLocalInput, toLocalInput } from '../../utils/format';

interface FormState {
  clubId: string;
  name: string;
  description: string;
  venue: string;
  eventType: 'Solo' | 'Team';
  teamSizeLimit: string;
  minTeamSize: string;
  fee: string;
  registrationLimit: string;
  eventDate: string;
  eventEndDate: string;
  registrationOpensAt: string;
  registrationDeadline: string;
  upiId: string;
  isPublished: boolean;
  bannerUrl: string | null | undefined; // undefined = unchanged
}

const empty: FormState = {
  clubId: '', name: '', description: '', venue: '', eventType: 'Solo', teamSizeLimit: '', minTeamSize: '1', fee: '0', registrationLimit: '100',
  eventDate: '', eventEndDate: '', registrationOpensAt: '', registrationDeadline: '', upiId: '', isPublished: true, bannerUrl: undefined,
};

const MAX_IMAGE = 5 * 1024 * 1024;

function fromEvent(e: EventRow): FormState {
  return {
    clubId: e.clubId,
    name: e.name,
    description: e.description ?? '',
    venue: e.venue ?? '',
    eventType: e.eventType === 'Team' ? 'Team' : 'Solo',
    teamSizeLimit: e.teamSizeLimit?.toString() ?? '',
    minTeamSize: e.minTeamSize?.toString() ?? '1',
    fee: String(e.fee ?? 0),
    registrationLimit: String(e.registrationLimit),
    eventDate: toLocalInput(e.eventDate),
    eventEndDate: toLocalInput(e.eventEndDate),
    registrationOpensAt: toLocalInput(e.registrationOpensAt),
    registrationDeadline: toLocalInput(e.registrationDeadline),
    upiId: e.upiId ?? '',
    isPublished: e.isPublished,
    bannerUrl: undefined,
  };
}

/** Client-side checks give instant feedback; the API validates everything again. */
function validate(f: FormState, isCreate: boolean): Record<string, string> {
  const errs: Record<string, string> = {};
  if (isCreate && !f.clubId) errs.clubId = 'Choose a club.';
  if (!f.name.trim()) errs.name = 'Event name is required.';
  if (!f.eventDate) errs.eventDate = 'Start date and time are required.';
  if (f.eventDate && f.eventEndDate && f.eventEndDate < f.eventDate) errs.eventEndDate = 'The end must be after the start.';
  if (f.registrationOpensAt && f.registrationDeadline && f.registrationDeadline < f.registrationOpensAt) errs.registrationDeadline = 'Closing must be after opening.';
  if (f.registrationOpensAt && f.eventDate && f.registrationOpensAt > f.eventDate) errs.registrationOpensAt = 'Registration must open before the event starts.';
  if (!(Number(f.fee) >= 0)) errs.fee = 'Enter 0 or a positive amount.';
  if (!Number.isInteger(Number(f.registrationLimit)) || Number(f.registrationLimit) < 1) errs.registrationLimit = 'Capacity must be at least 1.';
  if (f.eventType === 'Team') {
    if (!Number.isInteger(Number(f.teamSizeLimit)) || Number(f.teamSizeLimit) < 1) errs.teamSizeLimit = 'Set the maximum team size.';
    else if (Number(f.minTeamSize) > Number(f.teamSizeLimit)) errs.minTeamSize = 'Minimum cannot exceed maximum.';
  }
  return errs;
}

interface Props {
  open: boolean;
  onClose: () => void;
  event?: EventRow;
  onSaved: (event: EventRow) => void;
}

export function EventFormModal({ open, onClose, event, onSaved }: Props) {
  const isCreate = !event;
  const [f, setF] = useState<FormState>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setF(event ? fromEvent(event) : empty);
      setErrors({});
      setFormError(null);
    }
  }, [open, event]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF(prev => ({ ...prev, [k]: v }));
  const text = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => set(k, e.target.value as never);

  const pickImage = (file?: File) => {
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) return setFormError('Posters must be PNG, JPEG, WebP or GIF images.');
    if (file.size > MAX_IMAGE) return setFormError('The poster must be 5 MB or smaller.');
    const reader = new FileReader();
    reader.onload = () => set('bannerUrl', String(reader.result));
    reader.readAsDataURL(file);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs = validate(f, isCreate);
    setErrors(errs);
    setFormError(null);
    if (Object.keys(errs).length) return;

    const body: Record<string, unknown> = {
      name: f.name.trim(),
      description: f.description,
      venue: f.venue,
      eventType: f.eventType,
      fee: Number(f.fee),
      registrationLimit: Number(f.registrationLimit),
      eventDate: fromLocalInput(f.eventDate),
      eventEndDate: fromLocalInput(f.eventEndDate),
      registrationOpensAt: fromLocalInput(f.registrationOpensAt),
      // Optional: an empty closing date is sent as null so registration stays open until the event starts.
      registrationDeadline: fromLocalInput(f.registrationDeadline),
      upiId: f.upiId,
      isPublished: f.isPublished,
    };
    if (f.eventType === 'Team') {
      body.teamSizeLimit = Number(f.teamSizeLimit);
      body.minTeamSize = Number(f.minTeamSize || 1);
    }
    if (f.bannerUrl !== undefined) body.bannerUrl = f.bannerUrl;
    if (isCreate) body.clubId = f.clubId;

    setBusy(true);
    try {
      const res = isCreate ? await post<{ event: EventRow }>('/events', body) : await put<{ event: EventRow }>(`/events/${event.id}`, body);
      onSaved(res.event);
      onClose();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const currentBanner = f.bannerUrl === undefined ? event?.bannerUrl : f.bannerUrl;

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="lg"
      title={isCreate ? 'New event' : 'Edit event'}
      footer={
        <>
          <button className="ad-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="ad-btn-primary" form="event-form" disabled={busy}>{busy && <Spinner size={16} />} {isCreate ? 'Create event' : 'Save changes'}</button>
        </>
      }
    >
      <form id="event-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        {isCreate && (
          <div className="sm:col-span-2">
            <Field label="Club" error={errors.clubId}>
              <ClubSelect value={f.clubId} onChange={v => set('clubId', v)} allLabel="Select a club…" className="" label="Club" />
            </Field>
          </div>
        )}
        <div className="sm:col-span-2">
          <Field label="Event name" error={errors.name}><input className="ad-field" value={f.name} onChange={text('name')} maxLength={200} /></Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Description"><textarea className="ad-field min-h-24" value={f.description} onChange={text('description')} /></Field>
        </div>
        <Field label="Venue"><input className="ad-field" value={f.venue} onChange={text('venue')} /></Field>
        <Field label="Participation">
          <select className="ad-field" value={f.eventType} onChange={text('eventType')}>
            <option value="Solo">Solo</option>
            <option value="Team">Team</option>
          </select>
        </Field>
        {f.eventType === 'Team' && (
          <>
            <Field label="Max team size" error={errors.teamSizeLimit}><input className="ad-field" type="number" min={1} value={f.teamSizeLimit} onChange={text('teamSizeLimit')} /></Field>
            <Field label="Min team size" error={errors.minTeamSize}><input className="ad-field" type="number" min={1} value={f.minTeamSize} onChange={text('minTeamSize')} /></Field>
          </>
        )}
        <Field label="Fee (₹, 0 = free)" error={errors.fee}><input className="ad-field" type="number" min={0} step="1" value={f.fee} onChange={text('fee')} /></Field>
        <Field label="Capacity (registrations)" error={errors.registrationLimit}><input className="ad-field" type="number" min={1} value={f.registrationLimit} onChange={text('registrationLimit')} /></Field>
        <Field label="Event starts" error={errors.eventDate}><input className="ad-field" type="datetime-local" value={f.eventDate} onChange={text('eventDate')} /></Field>
        <Field label="Event ends" error={errors.eventEndDate}><input className="ad-field" type="datetime-local" value={f.eventEndDate} onChange={text('eventEndDate')} /></Field>
        <Field label="Registration opens (optional)" hint="Leave empty to open immediately." error={errors.registrationOpensAt}><input className="ad-field" type="datetime-local" value={f.registrationOpensAt} onChange={text('registrationOpensAt')} /></Field>
        <Field label="Registration closes (optional)" hint="Leave empty: registration stays open until the event starts, capacity is reached, or it is closed manually." error={errors.registrationDeadline}><input className="ad-field" type="datetime-local" value={f.registrationDeadline} onChange={text('registrationDeadline')} /></Field>
        <Field label="UPI ID (paid events)"><input className="ad-field" value={f.upiId} onChange={text('upiId')} /></Field>
        <Field label="Visibility">
          <select className="ad-field" value={f.isPublished ? 'published' : 'draft'} onChange={e => set('isPublished', e.target.value === 'published')}>
            <option value="published">Published — visible to everyone</option>
            <option value="draft">Draft — hidden from the public</option>
          </select>
        </Field>
        <div className="sm:col-span-2">
          <span className="mb-1.5 block text-xs font-semibold text-ad-muted">Poster</span>
          <div className="flex items-center gap-4">
            {currentBanner ? <img src={currentBanner} alt="Poster preview" className="h-20 w-32 rounded-xl border border-ad-line object-cover" /> : <div className="grid h-20 w-32 place-items-center rounded-xl border border-dashed border-ad-line text-ad-faint"><ImagePlus size={22} /></div>}
            <div className="flex gap-2">
              <label className="ad-btn-ghost ad-btn-sm cursor-pointer">
                Choose image
                <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" onChange={e => pickImage(e.target.files?.[0])} />
              </label>
              {currentBanner && <button type="button" className="ad-btn-ghost ad-btn-sm" onClick={() => set('bannerUrl', null)}><X size={14} /> Remove</button>}
            </div>
          </div>
        </div>
        {formError && <p role="alert" className="text-sm text-ad-brand sm:col-span-2">{formError}</p>}
      </form>
    </Modal>
  );
}
