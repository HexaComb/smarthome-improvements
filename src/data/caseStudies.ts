export interface CaseStudy {
  slug: string;
  service: 'roofing' | 'windows' | 'insulation';
  title: string;
  city: string;
  metaTitle: string;
  metaDescription: string;
  summary: string;
  image: string;
  imageAlt: string;
  before: string;
  after: string;
  beforeAlt?: string;
  afterAlt?: string;
  challenge: string;
  solution: string;
  result: string;
  highlights: string[];
  gallery: { src: string; alt: string }[];
  testimonial?: { text: string; name: string; city: string };
}

export const caseStudies: CaseStudy[] = [
  {
    slug: 'window-replacement-fresno-ivy-ave',
    service: 'windows',
    title: 'Old louvered windows to energy-efficient vinyl',
    city: 'Fresno, CA',
    metaTitle: 'Window Replacement Case Study in Fresno, CA',
    metaDescription:
      'See how Smart Home Improvements replaced dated louvered windows and security bars with energy-efficient white vinyl on a Fresno, CA home. Before and after, photos, and results.',
    summary:
      'A Fresno home traded dated louvered aluminum windows and security bars for clean, energy-efficient white vinyl, cutting heat and noise and transforming the curb appeal.',
    image: '/photos/case-studies/ivy/ivy-02.jpg',
    imageAlt: 'New white vinyl windows on a Fresno, CA home after replacement',
    before: '/photos/before-after/windows-before.jpg',
    after: '/photos/before-after/windows-after.jpg',
    challenge:
      'This Fresno home still had its original louvered aluminum windows, complete with metal security bars. They were drafty and hard to clean, let in heat and noise, leaked conditioned air, and made the whole home look dated from the street.',
    solution:
      'We removed every old window and installed custom-fit white vinyl windows with Low-E glass, measured for a tight, weatherproof seal. The crew worked clean inside and out and finished on schedule, with a full cleanup at the end.',
    result:
      'The home is noticeably cooler and quieter, the AC runs less during Fresno summers, and the exterior looks brand new. The homeowner went from old, barred louvers to bright, efficient windows that add comfort and curb appeal.',
    highlights: [
      'Old louvered windows and security bars removed',
      'Custom-fit white vinyl with Low-E glass',
      'Tight, weatherproof, draft-free seal',
      'Cooler, quieter home and lower AC load',
      'Clean install and full job-site cleanup',
    ],
    gallery: [
      { src: '/photos/case-studies/ivy/ivy-01.jpg', alt: 'Old louvered window with security bars before replacement in Fresno, CA' },
      { src: '/photos/case-studies/ivy/ivy-02.jpg', alt: 'New white vinyl windows on a Fresno, CA home, head-on view' },
      { src: '/photos/case-studies/ivy/ivy-03.jpg', alt: 'New vinyl windows along the side of a Fresno, CA home' },
      { src: '/photos/case-studies/ivy/ivy-04.jpg', alt: 'Bright new white vinyl windows on a Fresno, CA home' },
      { src: '/photos/case-studies/ivy/ivy-05.jpg', alt: 'Window installation in progress on a Fresno, CA home' },
      { src: '/photos/case-studies/ivy/ivy-06.jpg', alt: 'Finished white vinyl window on a Fresno, CA home' },
    ],
  },
  {
    slug: 'roof-replacement-fresno-farris-ave',
    service: 'roofing',
    title: 'Full tear-off to a light, heat-reflecting roof',
    city: 'Fresno, CA',
    metaTitle: 'Roof Replacement Case Study on Farris Ave, Fresno',
    metaDescription:
      'Photo-documented roof replacement on a Fresno home: full tear-off, deck prep, synthetic underlayment, and a light architectural shingle chosen for Valley heat.',
    summary:
      'An older Fresno home got a complete tear-off and a new light-colored architectural shingle roof, documented in photos from the first day of tear-off to the finished roof, main house and rear structure both.',
    image: '/photos/case-studies/farris/farris-06.jpg',
    imageAlt: 'Aerial view of a finished light gray architectural shingle roof on a Fresno, CA home',
    before: '/photos/case-studies/farris/farris-01.jpg',
    after: '/photos/case-studies/farris/farris-04.jpg',
    beforeAlt: 'Before: the Fresno home with its aging roof on day one, dumpster trailer staged for tear-off',
    afterAlt: 'After: the same home with its finished light gray architectural shingle roof',
    challenge:
      'This older Fresno home was carrying an aging, worn shingle roof over both the main house and the rear structure. In a climate that sees weeks of triple-digit heat, a dark, tired roof works against the whole house.',
    solution:
      'We tore both roofs off to the deck, checked the sheathing before anything went down over it, dried the roof in with synthetic underlayment, and installed a light-colored architectural shingle that reflects more of the Valley sun. The dumpster trailer was staged on day one and debris went straight into it, not onto the yard.',
    result:
      'The photos tell the story: from tear-off to a crisp, light, finished roof across the main house, rear structure, and porch gables. A roof this color works with the house in Fresno heat instead of against it, and the whole job is documented frame by frame.',
    highlights: [
      'Complete tear-off to the deck, no overlay',
      'Sheathing checked before dry-in',
      'Synthetic underlayment across the whole deck',
      'Light architectural shingle chosen for Valley heat',
      'Main house and rear structure both reroofed',
      'Photo-documented from day one to done',
    ],
    gallery: [
      { src: '/photos/case-studies/farris/farris-01.jpg', alt: 'Day one on a Fresno roof replacement, dumpster trailer staged in front of the home' },
      { src: '/photos/case-studies/farris/farris-02.jpg', alt: 'Aerial view of tear-off in progress, old shingles stripped to bare decking on sections of the roof' },
      { src: '/photos/case-studies/farris/farris-03.jpg', alt: 'Roof deck dried in with synthetic underlayment and materials staged on the ridge' },
      { src: '/photos/case-studies/farris/farris-04.jpg', alt: 'Front view of the finished light gray architectural shingle roof over the porch gables' },
      { src: '/photos/case-studies/farris/farris-05.jpg', alt: 'Top-down aerial of the completed light gray shingle roof' },
      { src: '/photos/case-studies/farris/farris-06.jpg', alt: 'Aerial view of the finished roof on the Fresno home and rear structure' },
    ],
  },
  {
    slug: 'roof-replacement-fresno-thesta-st',
    service: 'roofing',
    title: 'New decking, new shingles, solar back online',
    city: 'Fresno, CA',
    metaTitle: 'Re-Deck and Roof Replacement Case Study in Fresno',
    metaDescription:
      'Photo-documented Fresno roof replacement: complete re-sheeting with new decking, charcoal architectural shingles installed within days, and the solar array back on the finished roof.',
    summary:
      'A classic Fresno bungalow needed more than shingles: the roof was completely re-sheeted with new decking, shingled in charcoal architectural shingles within days, and the home’s solar array went back up on the finished roof.',
    image: '/photos/case-studies/thesta/thesta-03.jpg',
    imageAlt: 'Aerial view of a finished charcoal architectural shingle roof on a Fresno, CA bungalow',
    before: '/photos/case-studies/thesta/thesta-01.jpg',
    after: '/photos/case-studies/thesta/thesta-06.jpg',
    beforeAlt: 'During the job: the roof stripped and completely re-sheeted with new decking, seen from above',
    afterAlt: 'After: the finished charcoal shingle roof with the solar array remounted, seen from above',
    challenge:
      'This classic Fresno bungalow needed a roof the decking could no longer honestly support: the fix was not another layer of shingles, it was a fresh deck. The home also had a solar array that needed to come off and go back up around the roof work.',
    solution:
      'We stripped the roof completely and re-sheeted it with all-new decking, then dried it in and installed charcoal architectural shingles. The photos run from the fully re-decked roof to finished shingles within days, and the final frames show the solar array back in place on the new roof.',
    result:
      'The house went from a roof that needed structural attention to a brand-new system from the deck up, with the solar array remounted on top of it. Every stage is documented from the air: new sheathing, finished shingles, panels back online.',
    highlights: [
      'Complete tear-off with all-new roof sheathing',
      'Charcoal architectural shingles',
      'Shingles finished within days of the re-deck',
      'Solar array back up on the finished roof',
      'Every stage photo-documented from the air',
    ],
    gallery: [
      { src: '/photos/case-studies/thesta/thesta-01.jpg', alt: 'Top-down aerial of the Fresno roof fully re-sheeted with new decking' },
      { src: '/photos/case-studies/thesta/thesta-02.jpg', alt: 'Aerial view of the bungalow with brand-new roof decking installed edge to edge' },
      { src: '/photos/case-studies/thesta/thesta-03.jpg', alt: 'Aerial view of the finished charcoal architectural shingle roof' },
      { src: '/photos/case-studies/thesta/thesta-04.jpg', alt: 'Top-down view of the completed charcoal shingle roof on the Fresno bungalow' },
      { src: '/photos/case-studies/thesta/thesta-05.jpg', alt: 'The finished roof with the solar array remounted, seen from the front' },
      { src: '/photos/case-studies/thesta/thesta-06.jpg', alt: 'Top-down aerial of the new roof with solar panels back in place' },
    ],
  },
];

export const caseStudiesFor = (service: string) => caseStudies.filter((c) => c.service === service);
