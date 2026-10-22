// Album titles: "Name (tail)" or "Name [tail]".
//
// The tail is what the uploader added after the name: a live set's place and date, a
// "Remastered" tag. The cards show the name first and the tail on the muted line under it.
// Only bracket groups that CLOSE the title count as the tail, so a bracket in the middle of
// a title ("Chapter (Part I) of Doom") stays part of the name.
export interface TitleParts {
  name: string;
  tail: string;
}

const OPENERS = '([';
const CLOSERS = ')]';
const MIN_NAME = 4;

// Where the bracket group that ends at `end` starts, or -1 when the title does not end in one.
function groupStart(title: string, end: number): number {
  if (CLOSERS.includes(title[end - 1])) {
    // closed: walk back to the bracket that opens it, counting nested pairs
    let depth = 0;
    for (let i = end - 1; i >= 0; i--) {
      const c = title[i];
      if (CLOSERS.includes(c)) depth++;
      else if (OPENERS.includes(c) && --depth === 0) return i;
    }
    return -1;
  }
  // The sync cuts long titles at a length limit ("... [Goregr..."), which leaves the last
  // group without its closer: an opener with no closer after it still starts the tail.
  const open = Math.max(title.lastIndexOf('(', end - 1), title.lastIndexOf('[', end - 1));
  return open >= 0 && !/[)\]]/.test(title.slice(open, end)) ? open : -1;
}

export function splitTitle(title: string): TitleParts {
  let end = title.trimEnd().length;
  let cut = -1;

  // Peel groups off the end, one at a time. A group counts only when whitespace sets it off
  // from what comes before, and what comes before is still a name (>= 4 characters).
  while (end > 0) {
    const open = groupStart(title, end);
    if (open < 0) break;
    const head = title.slice(0, open);
    const name = head.trimEnd();
    if (name.length === head.length || name.length < MIN_NAME) break;
    cut = open;
    end = name.length;
  }

  return cut < 0 ? { name: title, tail: '' } : { name: title.slice(0, end), tail: title.slice(cut).trim() };
}
