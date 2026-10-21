// Per-service photo walls (real jobs) shown on the service hub pages.
export interface GalleryPhoto {
  src: string;
  alt: string;
}

export const galleryByService: Record<string, GalleryPhoto[]> = {
  roofing: [
    '01', '02', '03', '04', '05', '06', '07', '08', '11', '12',
  ].map((n) => ({
    src: `/photos/gallery/work-${n}.jpg`,
    alt: 'Completed roofing project by Smart Home Improvements in the Central Valley',
  })),
  windows: [
    { src: '/photos/projects/windows-visalia-monte-vista.jpg', alt: 'New vinyl windows installed in Visalia, CA' },
    { src: '/photos/projects/windows-fresno-grove.jpg', alt: 'New white vinyl window on a Fresno, CA home' },
    { src: '/photos/projects/windows-fresno-ivy.jpg', alt: 'Replacement window after upgrading old windows in Fresno, CA' },
    { src: '/photos/projects/windows-fresno-4th-st.jpg', alt: 'Newly installed vinyl window on a Fresno, CA home' },
    { src: '/photos/gallery/work-09.jpg', alt: 'White vinyl window installed by Smart Home Improvements in Fresno, CA' },
    { src: '/photos/gallery/work-10.jpg', alt: 'Interior window installation in the Fresno, CA area' },
  ],
};
