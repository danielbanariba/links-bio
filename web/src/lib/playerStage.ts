// Where the ONE YouTube iframe sits. The Player renders a single iframe and never
// moves it in the DOM (moving an iframe reloads it, and the music stops): it lays
// a fixed wrapper over whichever slot is on screen and sizes it to that slot.
//   panel  the desktop right panel's square, while the now-playing view is closed
//   art    the now-playing view's art (desktop, tablet, the phone's sheet)
//   tile   the floating 200x200 video (phone and tablet with the view closed, and
//          anywhere the slot above is cut off)
// YouTube's embed rules apply to all of them: while it plays the player is at
// least 200x200, inside the viewport, not covered and not cropped.
// Pure geometry, no DOM: the island measures, this decides.

export type Layout = 'phone' | 'tablet' | 'desktop';
export type Surface = 'hidden' | 'panel' | 'art' | 'tile';
export type Corner = 'tl' | 'tr' | 'bl' | 'br';

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** YouTube's minimum player size, both ways. */
export const MIN_SIDE = 200;

/**
 * The surface the video goes to. Nothing while the player is closed. The view's
 * art while the view is open, else the desktop panel (phone and tablet have none:
 * they float the tile). A slot that cannot show a usable video (cut off by the
 * top bar, too small) gives the video to the tile, which always fits.
 */
export function pickSurface(s: {
  open: boolean;
  view: boolean;
  layout: Layout;
  usable: (slot: 'panel' | 'art') => boolean;
}): Surface {
  if (!s.open) return 'hidden';
  const wanted = s.view ? 'art' : s.layout === 'desktop' ? 'panel' : 'tile';
  return wanted === 'tile' || s.usable(wanted) ? wanted : 'tile';
}

/**
 * The iframe's box in a slot. 'fill' covers the slot: in a square, YouTube
 * letterboxes the 16:9 video itself. 'video' is the largest 16:9 box centred in
 * the slot, so the slot's own blurred cover shows around it, as long as that box
 * is still MIN_SIDE tall; a smaller slot is filled instead.
 */
export function videoBox(slot: Rect, fit: 'fill' | 'video'): Rect {
  if (fit === 'fill') return { ...slot };
  const width = Math.min(slot.width, (slot.height * 16) / 9);
  const height = (width * 9) / 16;
  if (height < MIN_SIDE) return { ...slot };
  return {
    left: slot.left + (slot.width - width) / 2,
    top: slot.top + (slot.height - height) / 2,
    width,
    height,
  };
}

/** True when `r` is at least MIN_SIDE both ways and wholly inside `bounds`. */
export function fitsInside(r: Rect, bounds: Rect): boolean {
  return (
    r.width >= MIN_SIDE &&
    r.height >= MIN_SIDE &&
    r.left >= bounds.left &&
    r.top >= bounds.top &&
    r.left + r.width <= bounds.left + bounds.width &&
    r.top + r.height <= bounds.top + bounds.height
  );
}

/**
 * The corner a dropped tile snaps to: the one on the side of the free area's
 * middle where its centre is. The free area is the viewport less the top bar and
 * the player bars at the bottom, so its middle is not the viewport's.
 */
export function nearestCorner(center: { x: number; y: number }, area: Rect): Corner {
  const v = center.y < area.top + area.height / 2 ? 't' : 'b';
  const h = center.x < area.left + area.width / 2 ? 'l' : 'r';
  return `${v}${h}` as Corner;
}

/** The same corner on the other side (the tile's grip button). */
export function otherSide(c: Corner): Corner {
  return `${c[0]}${c[1] === 'l' ? 'r' : 'l'}` as Corner;
}

/**
 * The tile's top-left in a corner of the free area. When the area is shorter
 * than the tile (a landscape tablet), the tile's bottom stays on the area's
 * bottom in both corners: it may cover the top bar but never the mini player or
 * the tab bar. `videoTop` is where the video starts inside the tile (below the
 * grip): the video itself never leaves the top of the viewport.
 */
export function tileAt(
  corner: Corner,
  area: Rect,
  tile: { width: number; height: number },
  videoTop: number,
): { left: number; top: number } {
  const left = corner[1] === 'l' ? area.left : area.left + area.width - tile.width;
  const bottomTop = area.top + area.height - tile.height;
  let top = corner[0] === 't' && area.height >= tile.height ? area.top : bottomTop;
  if (top + videoTop < 0) top = -videoTop;
  return { left, top };
}
