// Instant estimate brackets (installed, Fresno / Central Valley market).
// These are the SAME brackets published in the blog cost guides, so the tool
// and the articles never disagree. Ranges are honest brackets, not quotes:
// the free in-home assessment turns them into an exact written number.
// Update here when real job pricing is available from the owner.

export const windowEstimate = {
  // per window, installed
  perWindow: {
    standard: { label: 'Quality vinyl (dual-pane Low-E)', min: 750, max: 1500 },
    premium: { label: 'Premium Anlin (double lifetime warranty)', min: 1100, max: 2200 },
  },
  // large picture, bay, or specialty shapes
  specialty: { min: 2500, max: 5000 },
  // full-frame (down to the studs) vs retrofit insert
  fullFrame: { min: 1.3, max: 1.5 },
};

export const roofEstimate = {
  // $ per roofing square (100 sq ft), installed, including tear-off of one layer
  perSquare: {
    shingle: { label: 'Architectural shingle (cool-roof rated)', min: 400, max: 700 },
    tile: { label: 'Concrete tile', min: 800, max: 1200 },
    metal: { label: 'Standing-seam metal', min: 800, max: 1400 },
  },
  // roof area = footprint x pitch factor
  pitch: {
    low: { label: 'Low (nearly flat)', factor: 1.05 },
    medium: { label: 'Typical (4/12 to 6/12)', factor: 1.15 },
    steep: { label: 'Steep (7/12+)', factor: 1.3 },
  },
  // extra per square for each additional existing layer to tear off
  extraLayer: { min: 75, max: 150 },
};
