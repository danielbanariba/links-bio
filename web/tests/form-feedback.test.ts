// readFailure: what a form page shows when the forms API answers with an error.
//
// The defects these tests guard:
//  - a FastAPI 422 carries `detail` as an ARRAY of objects; the pages used to hand it to
//    `textContent`, so a visitor read "[object Object]" and no field was marked;
//  - a 429 is not the visitor's mistake, and it has to read differently from a rejected form
//    (nothing to fix, wait and retry);
//  - a failed answer with no JSON body (a proxy page, a dropped connection) must still give
//    a sentence, never an empty note.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFailure } from '../src/components/form-feedback.ts';

test('a 422 maps each failing field and drops the pydantic prefix', () => {
  const f = readFailure(422, {
    detail: [
      { type: 'value_error', loc: ['body', 'email'], msg: 'Value error, Invalid email address.' },
      { type: 'value_error', loc: ['body', 'band_name'], msg: 'Value error, This field cannot contain line breaks.' },
    ],
  });
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
  });
  assert.match(f.fields.description, /5,000/);
});

test('a 422 that names no field still gives a sentence', () => {
  const f = readFailure(422, { detail: [{ type: 'missing', loc: ['body'], msg: 'Field required' }] });
  assert.deepEqual(f.fields, {});
  assert.ok(f.message.length > 10);
});

test('a 429 is rate-limited whatever the body says, and has no fields to fix', () => {
  for (const body of [{ detail: 'Too many requests. Please try again later.' }, {}, null]) {
    const f = readFailure(429, body);
    assert.equal(f.kind, 'rate-limited');
    assert.deepEqual(f.fields, {});
  }
});

test('a 409 means the email is already on the list', () => {
  assert.equal(readFailure(409, { detail: 'This email is already subscribed.' }).kind, 'duplicate');
});

test('a 5xx shows the server sentence, or a fallback when there is no JSON', () => {
  assert.equal(readFailure(500, { detail: 'Could not save your submission. Please try again.' }).message, 'Could not save your submission. Please try again.');
  const bare = readFailure(502, null);
  assert.equal(bare.kind, 'server');
  assert.ok(bare.message.length > 10);
});

test('the two 400s the promo form can get mark their field, other 400s show the sentence', () => {
  // The backend answers these with a plain sentence, no field name; the page must still mark the field.
  const genre = readFailure(400, { detail: 'Please pick a genre.' });
  assert.equal(genre.kind, 'invalid');
  assert.deepEqual(genre.fields, { genre: 'Please pick a genre.' });
  const link = readFailure(400, { detail: 'Add at least one link.' });
  assert.deepEqual(link.fields, { youtube_url: 'Add at least one link.' });
  // A sentence we do not know has no field to mark: it stays a plain note, worded by the server.
  const other = readFailure(400, { detail: 'Something else was wrong.' });
  assert.equal(other.kind, 'rejected');
  assert.equal(other.message, 'Something else was wrong.');
  assert.deepEqual(other.fields, {});
});
