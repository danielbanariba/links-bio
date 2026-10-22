// form-feedback: what the three archive forms (submit, promo, newsletter) say back.
//
// readFailure() is pure: it turns a failed answer of the forms API (status + JSON body, or null
// when there was no JSON) from one of the three forms into a title, a sentence and, for a 422, the
// fields at fault. planFailure() is pure too: given the names of the fields the form really has,
// it decides which fields to mark and what the note says. The
// pages used to hand `detail` straight to textContent, and a FastAPI 422 carries it as an array
// of objects, so a visitor read "[object Object]" and no field was marked.
//
// createFeedback() is the small DOM half: the failure note above the button, the inline message
// under a field, and the busy flag the submit button's spinner hangs on. The request itself
// (endpoint, body, timeout) stays in each page's script.

export type FailureKind = 'invalid' | 'rate-limited' | 'duplicate' | 'rejected' | 'server';

/** The archive form a failed answer came from. */
export type FormName = 'submit' | 'promo' | 'newsletter';

export interface Failure {
  kind: FailureKind;
  title: string;
  message: string;
  /** Field name -> message, when the server named the fields at fault (422). */
  fields: Record<string, string>;
}

const FALLBACK = 'Something went wrong. Please try again.';

function sentence(detail: unknown): string {
  return typeof detail === 'string' && detail.trim() ? detail.trim() : '';
}

// pydantic prefixes its own ValueError texts with "Value error, ".
function clean(msg: unknown): string {
  return String(msg ?? '').replace(/^Value error,\s*/i, '').trim();
}

const count = new Intl.NumberFormat('en-US');

// The promo endpoint answers two missing-input cases with a plain 400 sentence and no field name.
// Matching the sentence lets the page mark the field instead of leaving a note far above it.
const SENTENCE_FIELDS: Record<string, string> = {
  'Please pick a genre.': 'genre',
  'Add at least one link.': 'youtube_url',
};

export function readFailure(status: number, body: unknown, form: FormName): Failure {
  const detail = body && typeof body === 'object' ? (body as { detail?: unknown }).detail : undefined;

  // Not the visitor's mistake: nothing to fix, wait and send again.
  if (status === 429) {
    return { kind: 'rate-limited', title: 'Too many requests', message: 'Please wait a few minutes and try again.', fields: {} };
  }

  // A 409 is the newsletter's "this email is already subscribed". Another form that got one (the
  // API does not send it today) is a duplicate of something already received, not a subscription:
  // its server sentence is not trusted to be about that form, so the neutral one is shown.
  if (status === 409) {
    return form === 'newsletter'
      ? { kind: 'duplicate', title: 'Already on the list', message: sentence(detail) || 'This email is already subscribed.', fields: {} }
      : { kind: 'duplicate', title: 'Already received', message: 'We already have this one, so there is no need to send it again.', fields: {} };
  }

  if (status === 422 && Array.isArray(detail)) {
    const fields: Record<string, string> = {};
    const loose: string[] = [];
    for (const item of detail) {
      const loc: unknown[] = Array.isArray(item?.loc) ? item.loc : [];
      const field = [...loc].reverse().find((p): p is string => typeof p === 'string' && p !== 'body');
      const text =
        item?.type === 'string_too_long' && item?.ctx?.max_length
          ? `Too long: ${count.format(Number(item.ctx.max_length))} characters at most.`
          : clean(item?.msg);
      if (!text) continue;
      if (field) fields[field] ??= text;
      else loose.push(text);
    }
    const message = Object.keys(fields).length
      ? 'Check the fields marked above and send it again.'
      : `Some of the details are not valid${loose.length ? `: ${loose.join(' ')}` : '.'} Check them and send it again.`;
    return { kind: 'invalid', title: 'Check the form', message, fields };
  }

  if (status >= 500) {
    return { kind: 'server', title: 'Not sent', message: sentence(detail) || 'Something went wrong on our side. Please try again in a moment.', fields: {} };
  }

  const said = sentence(detail);
  const field = status === 400 ? SENTENCE_FIELDS[said] : undefined;
  if (field) {
    return { kind: 'invalid', title: 'Check the form', message: 'Check the fields marked above and send it again.', fields: { [field]: said } };
  }

  return { kind: 'rejected', title: 'Not sent', message: said || FALLBACK, fields: {} };
}

/** A request that never got an answer (offline, timed out): the note without a server sentence. */
export function notSent(message: string): Failure {
  return { kind: 'server', title: 'Not sent', message, fields: {} };
}

export interface Plan {
  /** The sentence for the failure note. */
  text: string;
  /** Fields of this form to mark, top to bottom: [name, message under the field]. */
  marks: Array<[string, string]>;
}

const humanize = (name: string) => {
  const words = name.replace(/_/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
};
const endSentence = (text: string) => (/[.!?]$/.test(text) ? text : `${text}.`);

/** What the failure note says and which fields get a mark, given the names the form really has.
 *  The server may name a field this form does not have: its reason goes into the note (the
 *  visitor would never see it otherwise), and "check the fields marked above" is only said when
 *  at least one field is marked. */
export function planFailure(failure: Failure, formFields: string[]): Plan {
  const entries = Object.entries(failure.fields);
  const marks = entries
    .filter(([name]) => formFields.includes(name))
    .sort(([a], [b]) => formFields.indexOf(a) - formFields.indexOf(b));
  const unknown = entries
    .filter(([name]) => !formFields.includes(name))
    .map(([name, message]) => `${humanize(name)}: ${endSentence(message)}`)
    .join(' ');

  if (marks.length) {
    return { text: unknown ? `${failure.message} The server also flagged: ${unknown}` : failure.message, marks };
  }
  if (unknown) {
    return { text: `The server did not accept the form. ${unknown} Check what you entered and send it again.`, marks };
  }
  return { text: failure.message, marks };
}

// ─── DOM half ────────────────────────────────────────────────────────────────

export interface Feedback {
  /** Hide the failure note and remove every inline field message. */
  clear(): void;
  /** Mark one field and say why, under it. Moves focus there unless told not to. */
  fieldError(name: string, message: string, opts?: { focus?: boolean }): void;
  /** Show a Failure: the note, and the fields the server named. */
  fail(failure: Failure): void;
  /** The form is sending: the submit button shows its spinner while this is on. */
  busy(on: boolean): void;
}

export function createFeedback(form: HTMLFormElement, note: HTMLElement): Feedback {
  function clearField(input: Element) {
    input.classList.remove('is-invalid');
    input.removeAttribute('aria-invalid');
    input.removeAttribute('aria-describedby');
    const anchor = input.closest('.fm-pick') ?? input;
    const next = anchor.nextElementSibling;
    if (next?.classList.contains('fm-error')) next.remove();
  }

  function clear() {
    note.hidden = true;
    note.textContent = '';
    form.querySelectorAll('.is-invalid').forEach(clearField);
  }

  function fieldError(name: string, message: string, opts: { focus?: boolean } = {}) {
    const input = form.querySelector<HTMLElement>(`[name="${name}"]`);
    if (!input) return;
    clearField(input);
    input.classList.add('is-invalid');
    const id = `${name}-error`;
    const msg = document.createElement('p');
    msg.className = 'fm-error';
    msg.id = id;
    msg.textContent = message;
    (input.closest('.fm-pick') ?? input).insertAdjacentElement('afterend', msg);
    // The red edge and the sentence under the field must reach a screen reader too.
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', id);
    // The message goes as soon as the visitor fixes the field.
    input.addEventListener('input', () => clearField(input), { once: true });
    if (opts.focus !== false) {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      input.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
      input.focus({ preventScroll: true });
    }
  }

  function fail(failure: Failure) {
    const calm = failure.kind === 'rate-limited' || failure.kind === 'duplicate';
    // Mark only the fields this form really has, top to bottom, and focus the first one.
    const plan = planFailure(failure, Array.from(form.elements, (el) => (el as HTMLInputElement).name).filter(Boolean));
    note.className = `fm-note ${calm ? 'fm-note--calm' : 'fm-note--error'}`;
    note.textContent = '';
    const title = document.createElement('strong');
    title.textContent = failure.title;
    const text = document.createElement('span');
    text.textContent = plan.text;
    note.append(title, text);
    note.hidden = false;
    plan.marks.forEach(([name, message], i) => fieldError(name, message, { focus: i === 0 }));
    // With no field to focus, the note itself must be in view (it sits just above the button).
    if (plan.marks.length === 0) {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      note.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
    }
  }

  function busy(on: boolean) {
    if (on) form.setAttribute('aria-busy', 'true');
    else form.removeAttribute('aria-busy');
  }

  return { clear, fieldError, fail, busy };
}
