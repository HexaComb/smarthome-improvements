// City landing pages for local SEO. Each city gets a page at /service-areas/<slug>/
// with genuinely city-specific content (not templated duplicates), targeting
// searches like "<city> roofing", "roofing contractor <city>", and our other
// services. Keep this list aligned with the Google Business Profile service area.

export interface Area {
  slug: string;
  city: string; // "Fresno"
  county: string; // "Fresno County"
  core: boolean; // true = verified GBP service area
  image: string;
  imageAlt: string;
  metaTitle: string;
  metaDescription: string;
  // Short, link-friendly anchor used in city-link lists
  linkText: string;
  // One-line blurb for cards
  blurb: string;
  // Hero intro paragraph (unique per city)
  intro: string;
  // Local context paragraph (unique per city): climate, homes, landmarks
  localNote: string;
  // Distinct local touchpoints to weave in naturally
  neighborhoods: string[];
  // Extra city-specific FAQs appended to the standard three (verified facts only)
  faq?: { q: string; a: string }[];
}

const phone = '(559) 833-6945';

export const areas: Area[] = [
  {
    slug: 'fresno',
    city: 'Fresno',
    county: 'Fresno County',
    core: true,
    image: '/photos/projects/roof-fresno-tyler.jpg',
    imageAlt: 'Completed roof on a Fresno, CA home by Smart Home Improvements',
    metaTitle: 'Roofing, Windows & Insulation Contractor Serving Fresno, CA',
    metaDescription:
      'Local Fresno roofing, window, and insulation contractor. Licensed CA #1129883, 10+ years, free estimates. Roofs, windows, and insulation built for Fresno heat. Call (559) 833-6945.',
    linkText: 'Fresno roofing & home improvement',
    blurb: 'Our home base. Roofing, windows, and insulation across every Fresno neighborhood.',
    intro:
      'Fresno is our home base. We help homeowners across the city protect and improve their homes with quality roofing, energy-efficient windows, and insulation built for our long, hot summers.',
    localNote:
      'From the historic homes of the Tower District and Old Fig Garden to the newer builds in Woodward Park and Sunnyside, Fresno homes face the same challenge: relentless Central Valley sun and triple-digit summers. We choose roofing, windows, and insulation that stand up to that heat and keep your energy bills in check, neighborhood by neighborhood.',
    neighborhoods: ['Tower District', 'Old Fig Garden', 'Sunnyside', 'Woodward Park', 'Bullard', 'Fig Garden'],
  },
  {
    slug: 'clovis',
    city: 'Clovis',
    county: 'Fresno County',
    core: true,
    image: '/photos/projects/roof-clovis-el-paso.jpg',
    imageAlt: 'Completed roof replacement on a Clovis, CA home',
    metaTitle: 'Roofing, Windows & Insulation in Clovis, CA',
    metaDescription:
      'Local Clovis roofing, window, and insulation contractor. Licensed CA #1129883, free estimates. Quality roofs, windows, and insulation for Clovis homes. Call (559) 833-6945.',
    linkText: 'Clovis roofing & home improvement',
    blurb: 'From Old Town to the newest subdivisions, we serve all of Clovis.',
    intro:
      'Clovis blends historic charm with fast-growing new neighborhoods, and we serve all of it. Whether your home is decades old or brand new, we deliver roofing, windows, and insulation done right.',
    localNote:
      'Clovis is one of the fastest-growing communities in the Central Valley, with established homes near Old Town and newer subdivisions like Harlan Ranch and Loma Vista. Newer roofs still need repairs and upgrades, and older homes near Old Town Clovis often need replacement roofs, efficient windows, and better insulation to handle the valley heat. We handle both.',
    neighborhoods: ['Old Town Clovis', 'Harlan Ranch', 'Loma Vista', 'Deauville', 'Tarpey Village'],
  },
  {
    slug: 'madera',
    city: 'Madera',
    county: 'Madera County',
    core: true,
    image: '/photos/projects/roof-fresno-chance.jpg',
    imageAlt: 'Finished shingle roof installed by our crew on a Fresno, CA home',
    metaTitle: 'Roofing, Windows & Insulation in Madera, CA',
    metaDescription:
      'Local Madera roofing, window, and insulation contractor. Licensed CA #1129883, free estimates. Roofs, windows, and insulation built for the Madera climate. Call (559) 833-6945.',
    linkText: 'Madera roofing & home improvement',
    blurb: 'Serving Madera homeowners just north across the river.',
    intro:
      'Just north of Fresno across the San Joaquin River, Madera homeowners trust us for roofing, windows, and insulation that handle the heat and hold up for the long run.',
    localNote:
      'Madera sits in the heart of California wine and agriculture country, where homes range from in-town residences to properties on larger lots and acreage. That mix means everything from straightforward shingle reroofs to homes that need better insulation and efficient windows to fight the summer heat. We bring the same quality and clear communication to Madera that we give every job.',
    neighborhoods: ['Downtown Madera', 'Parkwood', 'Sierra Vista', 'Madera Ranchos'],
  },
  {
    slug: 'visalia',
    city: 'Visalia',
    county: 'Tulare County',
    core: true,
    image: '/photos/projects/windows-visalia-monte-vista.jpg',
    imageAlt: 'New vinyl windows installed on a Visalia, CA home',
    metaTitle: 'Roofing, Windows & Insulation in Visalia, CA',
    metaDescription:
      'Local Visalia roofing, window, and insulation contractor. Licensed CA #1129883, free estimates. Energy-efficient windows, roofing, and insulation for Visalia homes. Call (559) 833-6945.',
    linkText: 'Visalia roofing & home improvement',
    blurb: 'Roofing, windows, and insulation for Visalia, the gateway to the Sierras.',
    intro:
      'Known as the gateway to Sequoia and Kings Canyon, Visalia is a community of tree-lined streets and proud homeowners. We help them keep those homes comfortable and protected with quality roofing, windows, and insulation.',
    localNote:
      'We have installed energy-efficient windows and roofs across Visalia, including jobs near the historic downtown and established neighborhoods. With Tulare County summers every bit as hot as Fresno, Low-E windows, quality roofing, and proper insulation make a real difference in comfort and energy bills here.',
    neighborhoods: ['Downtown Visalia', 'Green Acres', 'College Area', 'Shannon Ranch'],
  },
  {
    slug: 'sanger',
    city: 'Sanger',
    county: 'Fresno County',
    core: false,
    image: '/photos/projects/roof-fresno-farris.jpg',
    imageAlt: 'Completed shingle roof installed by our crew on a Fresno, CA home',
    metaTitle: 'Roofing, Windows & Insulation in Sanger, CA',
    metaDescription:
      'Local Sanger roofing, window, and insulation contractor serving the Central Valley. Licensed CA #1129883, free estimates. Call (559) 833-6945.',
    linkText: 'Sanger roofing & home improvement',
    blurb: 'Serving Sanger, the Nation’s Christmas Tree City, east of Fresno.',
    intro:
      'Sanger, the Nation’s Christmas Tree City, sits at the gateway to the Sierra foothills east of Fresno. We bring quality roofing, windows, and insulation to Sanger homeowners who want the work done right.',
    localNote:
      'Closer to the foothills, Sanger homes still take the full force of Central Valley summer heat. We help local homeowners with durable roofs, efficient windows, and insulation that keeps homes comfortable and energy bills lower, with the same honest, local service we are known for.',
    neighborhoods: ['Downtown Sanger', 'Del Rey area', 'Centerville'],
  },
  {
    slug: 'selma',
    city: 'Selma',
    county: 'Fresno County',
    core: false,
    image: '/photos/projects/roof-fresno-lotus.jpg',
    imageAlt: 'Finished roof installed by our crew on a Fresno, CA home',
    metaTitle: 'Roofing, Windows & Insulation in Selma, CA',
    metaDescription:
      'Local Selma roofing, window, and insulation contractor serving the Central Valley. Licensed CA #1129883, free estimates. Call (559) 833-6945.',
    linkText: 'Selma roofing & home improvement',
    blurb: 'Roofing, windows, and insulation for Selma, the Raisin Capital of the World.',
    intro:
      'Selma, the Raisin Capital of the World, sits just south of Fresno along Highway 99. We help Selma homeowners protect and upgrade their homes with quality roofing, windows, and insulation.',
    localNote:
      'Selma’s mix of established and newer homes all face the same hot, dry valley summers. Whether it is a reroof, energy-efficient windows, or added attic insulation, we deliver the same quality and clear communication to Selma that we bring to every Central Valley job.',
    neighborhoods: ['Downtown Selma', 'Highland', 'Terry area'],
  },
  {
    slug: 'reedley',
    city: 'Reedley',
    county: 'Fresno County',
    core: false,
    image: '/photos/projects/roof-fresno-archie.jpg',
    imageAlt: 'Completed roof installed by our crew on a Fresno, CA home',
    metaTitle: 'Roofing, Windows & Insulation in Reedley, CA',
    metaDescription:
      'Local Reedley roofing, window, and insulation contractor serving the Central Valley. Licensed CA #1129883, free estimates. Call (559) 833-6945.',
    linkText: 'Reedley roofing & home improvement',
    blurb: 'Serving Reedley, the World’s Fruit Basket, on the Kings River.',
    intro:
      'Reedley, the World’s Fruit Basket, sits along the Kings River southeast of Fresno. We help local homeowners with roofing, windows, and insulation built for the Central Valley climate.',
    localNote:
      'From the historic downtown to homes along the Kings River, Reedley properties need roofing and insulation that handle hot summers and protect against the elements. We bring durable materials, efficient windows, and honest, local service to every Reedley project.',
    neighborhoods: ['Downtown Reedley', 'Sheridan', 'Reed Avenue area'],
  },
  {
    slug: 'kerman',
    city: 'Kerman',
    county: 'Fresno County',
    core: false,
    image: '/photos/projects/roof-hanford-lassen.jpg',
    imageAlt: 'Completed roof installed by our crew on a Hanford, CA home',
    metaTitle: 'Roofing, Windows & Insulation in Kerman, CA',
    metaDescription:
      'Local Kerman roofing, window, and insulation contractor serving the Central Valley. Licensed CA #1129883, free estimates. Call (559) 833-6945.',
    linkText: 'Kerman roofing & home improvement',
    blurb: 'Roofing, windows, and insulation for Kerman, west of Fresno.',
    intro:
      'West of Fresno, Kerman is a growing agricultural community where homeowners trust us for quality roofing, windows, and insulation that stand up to valley heat.',
    localNote:
      'Kerman’s open, sun-exposed setting makes a quality roof and good insulation especially important. We help local homeowners cut energy bills and stay comfortable with efficient windows, durable roofing, and proper insulation, backed by honest, upfront pricing.',
    neighborhoods: ['Downtown Kerman', 'Goldenrod area', 'Whitesbridge corridor'],
  },
  {
    slug: 'hanford',
    city: 'Hanford',
    county: 'Kings County',
    core: false,
    image: '/photos/projects/roof-hanford-lassen.jpg',
    imageAlt: 'Completed shingle roof on a Hanford, CA home with a backyard pool, aerial view',
    metaTitle: 'Roofing, Windows & Insulation in Hanford, CA',
    metaDescription:
      'Hanford roofing, window, and insulation contractor with completed local projects. Licensed CA #1129883, free estimates. Call (559) 833-6945.',
    linkText: 'Hanford roofing & home improvement',
    blurb: 'Completed roofs in Hanford, the Kings County seat south of Fresno.',
    intro:
      'Hanford, the Kings County seat, is a short drive down Highway 43 from our Fresno home base, and we have already put finished roofs on Hanford homes. We bring the same quality roofing, windows, and insulation to every Hanford project.',
    localNote:
      'From the historic downtown around Courthouse Square to newer neighborhoods on the edges of town, Hanford homes take the full Central Valley summer. We completed a full roof replacement on a Hanford home (you can see it on our projects page), and we install roofing, efficient windows, and attic insulation chosen for exactly this climate.',
    neighborhoods: ['Downtown Hanford', 'Courthouse Square area', 'North Hanford'],
    faq: [
      {
        q: 'Have you actually done work in Hanford?',
        a: 'Yes. We completed a full shingle roof replacement on a Hanford home, and the photos are on our projects page. We are happy to talk through that job when you call.',
      },
    ],
  },
  {
    slug: 'parlier',
    city: 'Parlier',
    county: 'Fresno County',
    core: false,
    image: '/photos/projects/roof-parlier-candice.jpg',
    imageAlt: 'New residential shingle roof in Parlier, CA, aerial view',
    metaTitle: 'Roofing, Windows & Insulation in Parlier, CA',
    metaDescription:
      'Parlier roofing, window, and insulation contractor with completed local projects. Licensed CA #1129883, free estimates. Hablamos espanol. Call (559) 833-6945.',
    linkText: 'Parlier roofing & home improvement',
    blurb: 'Completed roofs in Parlier, southeast of Fresno in the heart of ag country.',
    intro:
      'Parlier sits southeast of Fresno in the heart of Central Valley agriculture, and we have already completed a full reroof for a Parlier family. We bring quality roofing, windows, and insulation, and a Spanish-speaking team, to Parlier homeowners.',
    localNote:
      'Parlier homes work hard through hot, dusty summers, and a solid roof with good attic insulation makes a real difference in comfort and energy bills. We completed a complete shingle roof replacement for a Parlier family home (photos on our projects page), and hablamos espanol: our Spanish page and Spanish-speaking team make the whole process easy.',
    neighborhoods: ['Downtown Parlier', 'Manning Avenue corridor', 'Zediker area'],
    faq: [
      {
        q: 'Have you actually done work in Parlier?',
        a: 'Yes. We completed a full shingle roof replacement for a Parlier family home, and the photos are on our projects page. We are happy to walk you through that job when you call.',
      },
      {
        q: 'Hablan espanol?',
        a: 'Si. Our team speaks Spanish, and our Spanish page at /es/ has the whole process in Spanish, from the free estimate to the finished job.',
      },
    ],
  },
];

export const coreAreas = areas.filter((a) => a.core);
export { phone };
