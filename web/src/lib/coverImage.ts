// The sharp side of the cover pipeline: decode a downloaded YouTube frame into the
// raw pixels the detector reads, and render the crop and the review preview.
// Node-only (sharp); the detector itself (coverDetect.ts) stays pure.
import sharp from 'sharp';
import { FRAME_H, FRAME_W } from './coverDetect.ts';
import type { CoverBox, RawFrame } from './coverDetect.ts';

/** Side of the square WebP written for each cover. Cards show it at <= ~300 CSS px. */
export const CROP_SIZE = 400;
export const CROP_QUALITY = 80;
export const PREVIEW_W = 320;
export const PREVIEW_H = 180;

/**
 * The frame as a 1280x720 image, or null when it is not 16:9. maxresdefault is
 * 1280x720 for nearly every video; the catalogue has one 4:3 sddefault (letterboxed),
 * where the detector's geometry would be meaningless. Other 16:9 sizes (a 1080p
 * thumbnail) are scaled into the same geometry so boxes keep one coordinate space.
 * Returns the input buffer itself when it is already 1280x720.
 */
export async function normalizeFrame(image: Buffer): Promise<Buffer | null> {
  const { width, height } = await sharp(image).metadata();
  if (!width || !height) return null;
  if (Math.abs(width / height - FRAME_W / FRAME_H) > 0.02) return null;
  if (width === FRAME_W && height === FRAME_H) return image;
  return sharp(image).resize(FRAME_W, FRAME_H, { fit: 'fill' }).jpeg({ quality: 95 }).toBuffer();
}

/** Raw RGB pixels of a frame that normalizeFrame accepted. */
export async function toRawFrame(image: Buffer): Promise<RawFrame> {
  const { data, info } = await sharp(image).removeAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, channels: info.channels };
}

/** The 400px WebP crop of a box of a (normalized) 1280x720 frame. */
export function renderCrop(frame: Buffer, box: CoverBox): Promise<Buffer> {
  const [left, top, size] = box;
  return sharp(frame)
    .extract({ left, top, width: size, height: size })
    .resize(CROP_SIZE, CROP_SIZE, { fit: 'fill' })
    .webp({ quality: CROP_QUALITY })
    .toBuffer();
}

/** A 320x180 WebP of the whole frame, kept so the contact sheets need no re-download. */
export function renderPreview(frame: Buffer): Promise<Buffer> {
  return sharp(frame).resize(PREVIEW_W, PREVIEW_H, { fit: 'fill' }).webp({ quality: 70 }).toBuffer();
}
