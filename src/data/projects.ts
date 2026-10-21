// Real completed projects. Photos optimized into /public/photos/projects.
// Location captions double as strong local-SEO signals and image alt text.

export interface Project {
  slug: string;
  service: 'roofing' | 'windows';
  title: string;
  city: string; // "Fresno, CA"
  image: string;
  alt: string;
  blurb: string;
}

export const projects: Project[] = [
  {
    slug: 'roof-clovis-el-paso',
    service: 'roofing',
    title: 'Full roof replacement',
    city: 'Clovis, CA',
    image: '/photos/projects/roof-clovis-el-paso.jpg',
    alt: 'Completed asphalt shingle roof replacement on a home in Clovis, CA by Smart Home Improvements',
    blurb: 'New architectural shingle roof installed on a single-story Clovis home.',
  },
  {
    slug: 'roof-fresno-tyler',
    service: 'roofing',
    title: 'Architectural shingle reroof',
    city: 'Fresno, CA',
    image: '/photos/projects/roof-fresno-tyler.jpg',
    alt: 'Aerial view of a finished charcoal architectural shingle roof in Fresno, CA',
    blurb: 'Tear-off and full reroof with charcoal architectural shingles in central Fresno.',
  },
  {
    slug: 'roof-fresno-lotus',
    service: 'roofing',
    title: 'Roof replacement',
    city: 'Fresno, CA',
    image: '/photos/projects/roof-fresno-lotus.jpg',
    alt: 'Newly replaced gray shingle roof on a Fresno, CA home, aerial view',
    blurb: 'Durable new shingle system built for Central Valley sun and heat.',
  },
  {
    slug: 'roof-fresno-chance',
    service: 'roofing',
    title: 'Reroof and ridge work',
    city: 'Fresno, CA',
    image: '/photos/projects/roof-fresno-chance.jpg',
    alt: 'Completed shingle roof with clean ridge lines on a Fresno, CA home',
    blurb: 'Full replacement with new underlayment, flashing, and ridge caps.',
  },
  {
    slug: 'roof-fresno-farris',
    service: 'roofing',
    title: 'Single-family reroof',
    city: 'Fresno, CA',
    image: '/photos/projects/roof-fresno-farris.jpg',
    alt: 'Aerial photo of a finished residential shingle roof in Fresno, CA',
    blurb: 'Complete tear-off and reroof finished on schedule and left spotless.',
  },
  {
    slug: 'roof-fresno-archie',
    service: 'roofing',
    title: 'Roof replacement',
    city: 'Fresno, CA',
    image: '/photos/projects/roof-fresno-archie.jpg',
    alt: 'New shingle roof on a Fresno, CA single-story home, aerial view',
    blurb: 'Weather-ready shingle roof replacement in south Fresno.',
  },
  {
    slug: 'roof-fresno-thesta',
    service: 'roofing',
    title: 'Tear-off and underlayment',
    city: 'Fresno, CA',
    image: '/photos/projects/roof-fresno-thesta.jpg',
    alt: 'Roof replacement in progress showing fresh underlayment in Fresno, CA',
    blurb: 'Old roof torn off and prepped with new underlayment before shingles.',
  },
  {
    slug: 'roof-fresno-alta',
    service: 'roofing',
    title: 'Reroof in progress',
    city: 'Fresno, CA',
    image: '/photos/projects/roof-fresno-alta.jpg',
    alt: 'Roof decking and underlayment during a reroof in Fresno, CA',
    blurb: 'A reroof underway, showing the clean prep work behind a lasting roof.',
  },
  {
    slug: 'roof-hanford-lassen',
    service: 'roofing',
    title: 'Roof replacement',
    city: 'Hanford, CA',
    image: '/photos/projects/roof-hanford-lassen.jpg',
    alt: 'Completed shingle roof on a Hanford, CA home with a backyard pool, aerial view',
    blurb: 'Full roof replacement on a Hanford home, finished clean around the pool.',
  },
  {
    slug: 'roof-parlier-candice',
    service: 'roofing',
    title: 'Full reroof',
    city: 'Parlier, CA',
    image: '/photos/projects/roof-parlier-candice.jpg',
    alt: 'New residential shingle roof in Parlier, CA, aerial view',
    blurb: 'Complete shingle roof replacement for a Parlier family home.',
  },
  {
    slug: 'windows-visalia-monte-vista',
    service: 'windows',
    title: 'Energy-efficient window replacement',
    city: 'Visalia, CA',
    image: '/photos/projects/windows-visalia-monte-vista.jpg',
    alt: 'New white vinyl grid window installed on a Visalia, CA home',
    blurb: 'Crisp new vinyl windows that cut heat gain and lift curb appeal.',
  },
  {
    slug: 'windows-fresno-grove',
    service: 'windows',
    title: 'Window replacement',
    city: 'Fresno, CA',
    image: '/photos/projects/windows-fresno-grove.jpg',
    alt: 'New white vinyl window on a stucco home in Fresno, CA',
    blurb: 'Clean retrofit window install with a tight, weatherproof fit.',
  },
  {
    slug: 'windows-fresno-ivy',
    service: 'windows',
    title: 'Old windows replaced',
    city: 'Fresno, CA',
    image: '/photos/projects/windows-fresno-ivy.jpg',
    alt: 'Replacement white vinyl window after upgrading old windows in Fresno, CA',
    blurb: 'Dated windows swapped for efficient white vinyl across the home.',
  },
  {
    slug: 'windows-fresno-4th-st',
    service: 'windows',
    title: 'New vinyl windows',
    city: 'Fresno, CA',
    image: '/photos/projects/windows-fresno-4th-st.jpg',
    alt: 'Newly installed white vinyl window on a Fresno, CA home exterior',
    blurb: 'Bright, energy-efficient vinyl windows installed in north Fresno.',
  },
];

export const projectsByService = (service: string) =>
  projects.filter((p) => p.service === service);
