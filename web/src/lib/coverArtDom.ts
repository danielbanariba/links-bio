// The browser-side twin of components/CoverArt.astro, for the parts of a page
// that draw a cover after load (the sidebar's Recent list, the home hero once
// something plays): the same markup for the same coverMode, so the same CSS
// draws it. Built with createElement, never innerHTML: the src comes from stored
// or published data.
import { coverMode } from './coverDisplay.js';

export function coverArtElement(src: string, className = '', loading: 'lazy' | 'eager' = 'lazy'): HTMLElement {
  const box = document.createElement('span');
  const mode = coverMode(src);
  box.className = ['ma-art', mode === 'frame' ? 'ma-art--frame' : mode === 'none' ? 'ma-art--none' : '', className]
    .filter(Boolean)
    .join(' ');
  if (mode === 'none') return box;
  const img = (cls: string) => {
    const el = document.createElement('img');
    el.className = cls;
    el.src = src;
    el.alt = '';
    el.decoding = 'async';
    el.loading = loading;
    return el;
  };
  if (mode === 'square') {
    box.append(img('ma-art__img'));
  } else {
    const frame = document.createElement('span');
    frame.className = 'ma-art__frame';
    frame.append(img('ma-art__img'));
    box.append(img('ma-art__bg'), frame);
  }
  return box;
}
