// Responsive-image helpers. Every JPEG under public/photos (except gbp-posts,
// which are GBP upload assets) has pre-generated WebP variants next to it:
//   heroes:     -800 / -1280 / -2000  (magick x.jpg -resize {w}x  -quality 72)
//   everything: -480 / -800 / -1200   (magick x.jpg -resize {w}x> -quality 72)
// Regenerate variants whenever a photo is added or replaced.
const HERO_WIDTHS = [800, 1280, 2000];
const CARD_WIDTHS = [480, 800, 1200];

const isHero = (src: string) => /^\/photos\/hero\/[^/]+\.jpg$/.test(src) || /-hero\.jpg$/.test(src);
const isPhoto = (src: string) =>
  /^\/photos\/(?!gbp-posts\/)[^?]+\.jpg$/.test(src) && !/-avatar\.jpg$/.test(src);

/** srcset for a full-bleed hero image, or undefined when no variants exist. */
export function webpSrcset(src: string): string | undefined {
  if (!isHero(src)) return undefined;
  const base = src.replace(/\.jpg$/, '');
  return HERO_WIDTHS.map((w) => `${base}-${w}.webp ${w}w`).join(', ');
}

/** srcset for a card/gallery-sized photo (480/800/1200), or undefined. */
export function cardSrcset(src: string): string | undefined {
  if (!isPhoto(src)) return undefined;
  const base = src.replace(/\.jpg$/, '');
  return (isHero(src) ? HERO_WIDTHS : CARD_WIDTHS).map((w) => `${base}-${w}.webp ${w}w`).join(', ');
}
