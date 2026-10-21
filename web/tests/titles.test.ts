// splitTitle: the name/tail split behind the album cards.
//
// The defect these tests guard (R3-003): the split cut at the FIRST " (" after four
// characters, so a title with a bracket in the middle showed only its first word as the
// card's name and pushed the rest of the title into the muted line. The tail is only what
// closes the title: one or more bracket groups at the very end.
import test from 'node:test';
import assert from 'node:assert/strict';
import { splitTitle } from '../src/lib/titles.ts';

test('a live set peels off its trailing place and date', () => {
  assert.deepEqual(splitTitle('Megametal (Live in Honduras, 2019)'), {
    name: 'Megametal',
    tail: '(Live in Honduras, 2019)',
  });
});

test('several trailing groups, round and square, all go to the tail', () => {
  assert.deepEqual(splitTitle('Anagnorisis (Feat. Allan Fiallos) (Live In Metal Show - December 13, 2019)'), {
    name: 'Anagnorisis',
    tail: '(Feat. Allan Fiallos) (Live In Metal Show - December 13, 2019)',
  });
  assert.deepEqual(splitTitle('Tha Fallen Wiggaz [Remastered 2020] (Live)'), {
    name: 'Tha Fallen Wiggaz',
    tail: '[Remastered 2020] (Live)',
  });
});

test('a bracket in the middle of the title stays in the name', () => {
  // the old split cut after "4": the card then showed a one-character name
  assert.deepEqual(splitTitle('4 (The Messianic Age) remastered'), {
    name: '4 (The Messianic Age) remastered',
    tail: '',
  });
  assert.deepEqual(splitTitle('Chapter (Part I) of Doom (Live in Rome)'), {
    name: 'Chapter (Part I) of Doom',
    tail: '(Live in Rome)',
  });
});

test('a group that nests another is one tail', () => {
  assert.deepEqual(splitTitle('Abomination (Live (Acoustic) in Rome)'), {
    name: 'Abomination',
    tail: '(Live (Acoustic) in Rome)',
  });
  // the inner bracket is not set off by a space, so it can never start the tail on its own
  assert.deepEqual(splitTitle('Abomination (Remastered(2020))'), {
    name: 'Abomination',
    tail: '(Remastered(2020))',
  });
});

test('a tail the sync cut off at its length limit is still the tail', () => {
  // real titles are stored cut at ~70 characters: "... [Goregr..." has no closing bracket
  assert.deepEqual(splitTitle('Liturgies Of Lust And Perversion [Technical Brutal Death...'), {
    name: 'Liturgies Of Lust And Perversion',
    tail: '[Technical Brutal Death...',
  });
});

test('a title that is nothing but a bracket, or whose name would be under four characters, is not split', () => {
  assert.deepEqual(splitTitle('(Live in Rome)'), { name: '(Live in Rome)', tail: '' });
  assert.deepEqual(splitTitle('Ab (Live in Rome)'), { name: 'Ab (Live in Rome)', tail: '' });
});
