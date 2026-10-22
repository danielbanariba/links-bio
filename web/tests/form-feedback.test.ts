// readFailure: what a form page shows when the forms API answers with an error.
//
// The defects these tests guard:
//  - a FastAPI 422 carries `detail` as an ARRAY of objects; the pages used to hand it to
//    `textContent`, so a visitor read "[object Object]" and no field was marked;
//  - a 429 is not the visitor's mistake, and it has to read differently from a rejected form
//    (nothing to fix, wait and retry);
//  - a failed answer with no JSON body (a proxy page, a dropped connection) must still give
//    a sentence, never an empty note;
//  - a 409 is only "already on the list" on the newsletter form: a band submission or a promo
//    request that got one must not tell the visitor they are subscribed;
//  - planFailure() decides the note and the marks from what the form really has: the server's
//    reason for a field this form lacks was dropped (the visitor saw nothing), and "check the
//    fields marked above" was shown even when no field was marked.
import test from 'node:test';
import assert from 'node:assert/strict';
import { planFailure, readFailure } from '../src/components/form-feedback.ts';

test('a 422 maps each failing field and drops the pydantic prefix', () => {
  const f = readFailure(422, {
    detail: [
      { type: 'value_error', loc: ['body', 'email'], msg: 'Value error, Invalid email address.' },
      { type: 'value_error', loc: ['body', 'band_name'], msg: 'Value error, This field cannot contain line breaks.' },
    ],
  }, 'submit');
  assert.equal(f.kind, 'invalid');
  assert.deepEqual(f.fields, {
    email: 'Invalid email address.',
    band_name: 'This field cannot contain line breaks.',
  });
  assert.doesNotMatch(f.message, /object Object/);
});

test('a too-long field says how long it may be', () => {
  const f = readFailure(422, {
    detail: [{ type: 'string_too_long', loc: ['body', 'description'], msg: 'String should have at most 5000 characters', ctx: { max_length: 5000 } }],
  }, 'submit');
  assert.match(f.fields.description, /5,000/);
});

test('a 422 that names no field still gives a sentence', () => {
  const f = readFailure(422, { detail: [{ type: 'missing', loc: ['body'], msg: 'Field required' }] }, 'submit');
  assert.deepEqual(f.fields, {});
  assert.ok(f.message.length > 10);
});

test('a 429 is rate-limited whatever the body says, and has no fields to fix', () => {
  for (const body of [{ detail: 'Too many requests. Please try again later.' }, {}, null]) {
    const f = readFailure(429, body, 'newsletter');
    assert.equal(f.kind, 'rate-limited');
    assert.deepEqual(f.fields, {});
  }
});

test('a 409 on the newsletter form means the email is already on the list', () => {
  const f = readFailure(409, { detail: 'This email is already subscribed.' }, 'newsletter');
  assert.equal(f.kind, 'duplicate');
  assert.equal(f.title, 'Already on the list');
  assert.equal(f.message, 'This email is already subscribed.');
  // Even with no body the newsletter still says what it means.
  assert.match(readFailure(409, null, 'newsletter').message, /subscribed/);
});

test('a 409 on any other form never mentions a list or a subscription', () => {
  for (const form of ['submit', 'promo'] as const) {
    // the newsletter's own sentence arriving on the wrong form must not be shown either
    const f = readFailure(409, { detail: 'This email is already subscribed.' }, form);
    assert.equal(f.kind, 'duplicate', 'still a calm note, not an error');
    assert.doesNotMatch(`${f.title} ${f.message}`, /list|subscri/i);
    assert.ok(f.message.length > 10);
  }
});

test('a 5xx shows the server sentence, or a fallback when there is no JSON', () => {
  assert.equal(readFailure(500, { detail: 'Could not save your submission. Please try again.' }, 'submit').message, 'Could not save your submission. Please try again.');
  const bare = readFailure(502, null, 'submit');
  assert.equal(bare.kind, 'server');
  assert.ok(bare.message.length > 10);
});

test('the two 400s the promo form can get mark their field, other 400s show the sentence', () => {
  // The backend answers these with a plain sentence, no field name; the page must still mark the field.
  const genre = readFailure(400, { detail: 'Please pick a genre.' }, 'promo');
  assert.equal(genre.kind, 'invalid');
  assert.deepEqual(genre.fields, { genre: 'Please pick a genre.' });
  const link = readFailure(400, { detail: 'Add at least one link.' }, 'promo');
  assert.deepEqual(link.fields, { youtube_url: 'Add at least one link.' });
  // A sentence we do not know has no field to mark: it stays a plain note, worded by the server.
  const other = readFailure(400, { detail: 'Something else was wrong.' }, 'promo');
  assert.equal(other.kind, 'rejected');
  assert.equal(other.message, 'Something else was wrong.');
  assert.deepEqual(other.fields, {});
});

// ─── planFailure: the note and the marks, from the fields the form really has ────

const FIELDS = ['band_name', 'contact_email', 'genre', 'website'];

test('a failure naming fields of the form marks them in form order and keeps the generic sentence', () => {
  const f = readFailure(422, {
    detail: [
      { type: 'value_error', loc: ['body', 'genre'], msg: 'Value error, Pick a genre.' },
      { type: 'value_error', loc: ['body', 'band_name'], msg: 'Value error, Name is empty.' },
    ],
  }, 'submit');
  const plan = planFailure(f, FIELDS);
  assert.deepEqual(plan.marks.map(([name]) => name), ['band_name', 'genre']);
  assert.match(plan.text, /marked above/);
});

test('the server reason for a field this form lacks is in the note, and nothing points at marks that are not there', () => {
  const f = readFailure(422, {
    detail: [{ type: 'value_error', loc: ['body', 'site_url'], msg: 'Value error, Invalid URL.' }],
  }, 'submit');
  const plan = planFailure(f, FIELDS);
  assert.deepEqual(plan.marks, []);
  assert.match(plan.text, /Invalid URL\./);
  assert.doesNotMatch(plan.text, /marked above/);
});

test('with some fields marked and some unknown, the note keeps the sentence and adds the unknown reasons', () => {
  const f = readFailure(422, {
    detail: [
      { type: 'value_error', loc: ['body', 'contact_email'], msg: 'Value error, Invalid email address.' },
      { type: 'value_error', loc: ['body', 'site_url'], msg: 'Value error, Invalid URL.' },
    ],
  }, 'submit');
  const plan = planFailure(f, FIELDS);
  assert.deepEqual(plan.marks.map(([name]) => name), ['contact_email']);
  assert.match(plan.text, /marked above/);
  assert.match(plan.text, /Invalid URL\./);
  // the marked field's own reason lives under its field, not in the note
  assert.doesNotMatch(plan.text, /Invalid email address/);
});

test('a 422 that names no field keeps the sentence readFailure wrote, with its reasons', () => {
  const f = readFailure(422, { detail: [{ type: 'value_error', loc: ['body'], msg: 'Value error, Pick a date range.' }] }, 'submit');
  const plan = planFailure(f, FIELDS);
  assert.deepEqual(plan.marks, []);
  assert.equal(plan.text, f.message);
  assert.match(plan.text, /Pick a date range\./);
});

test('failures that are not about fields pass their message through untouched', () => {
  for (const f of [readFailure(429, null, 'submit'), readFailure(500, null, 'submit'), readFailure(409, null, 'newsletter')]) {
    const plan = planFailure(f, FIELDS);
    assert.deepEqual(plan.marks, []);
    assert.equal(plan.text, f.message);
  }
});
