// Service hub + sub-page content. Drives /[service]/ hubs and /[service]/[slug] pages.

export interface Faq {
  q: string;
  a: string;
}

export interface SubService {
  slug: string;
  name: string;
  short: string; // one-line for hub cards
  metaTitle: string;
  metaDescription: string;
  h1: string;
  intro: string;
  image: string;
  imageAlt: string;
  highlights: string[];
  body: { heading: string; text: string }[];
  faqs: Faq[];
}

export interface ServiceContent {
  slug: string;
  name: string;
  icon: string;
  metaTitle: string;
  metaDescription: string;
  summary: string;
  hero: { eyebrow: string; title: string; intro: string };
  image: string;
  imageAlt: string;
  /** Optional override for the home-page service card (e.g. a cleaner finished-job photo). */
  cardImage?: string;
  cardImageAlt?: string;
  /** Optional isometric hero illustration (SVG path). Replaces the photo hero background. */
  heroIllustration?: string;
  /** Optional isometric feature illustration (SVG path) for the "quality runs deeper" row. */
  featureIllustration?: string;
  offerings: { icon: string; title: string; text: string }[];
  benefits: string[];
  faqs: Faq[];
  materialsHeading?: string;
  materialsIntro?: string;
  materials?: { icon: string; name: string; text: string; illustration?: string }[];
  children: SubService[];
}

export const serviceContent: Record<string, ServiceContent> = {
  roofing: {
    slug: 'roofing',
    name: 'Roofing',
    icon: 'roof',
    metaTitle: 'Roofing Contractor in Fresno, CA | Repair & Replacement',
    metaDescription:
      'Licensed Fresno roofing contractor for roof repair and replacement. Asphalt, metal, and tile roofs built for the Central Valley. CA #1129883. Free estimates, (559) 833-6945.',
    summary:
      'Durable, high-quality roofing built for the Central Valley, from fast leak repairs to full replacements.',
    hero: {
      eyebrow: 'Roofing',
      title: 'Central Valley roofing contractor',
      intro:
        "One licensed local crew for everything above your walls. We repair leaks, replace roofs that have reached the end of their life, respond fast after storms, and handle siding and commercial work too. Each service below has its own page with the process, the cost drivers, and honest answers, or just call and we will point you the right way.",
    },
    image: '/photos/roofing/roofing-hero.jpg',
    imageAlt:
      'Aerial view of a completed architectural shingle roof installed by Smart Home Improvements in Fresno, CA',
    heroIllustration: '/illustrations/roofing-hero.svg',
    featureIllustration: '/illustrations/roof-cutaway.svg',
    offerings: [
      {
        icon: 'wrench',
        title: 'Roof Repair',
        text: 'A targeted fix when the roof is still fundamentally sound. The Roof Repair page covers how a repair visit works and what moves the price.',
      },
      {
        icon: 'roof',
        title: 'Roof Replacement',
        text: 'When repairs stop making sense, we tear off and rebuild the whole system. The Residential Roofing page walks through the process, materials, and costs.',
      },
      {
        icon: 'shield',
        title: 'Built for Our Climate',
        text: 'Asphalt shingle, metal, and tile options chosen to handle Central Valley heat, sun, and seasonal storms.',
      },
    ],
    benefits: [
      'Free, no-obligation roof inspections and estimates',
      'High-quality asphalt, metal, and tile roofing options',
      'Licensed, experienced crews (CA #1129883)',
      'Clean job sites and on-schedule completion',
      'Honest, upfront pricing with no surprises',
    ],
    faqs: [
      {
        q: 'How do I know if I need a roof repair or full replacement?',
        a: 'We start with a free inspection. Minor leaks or a few damaged shingles can often be repaired. Widespread granule loss, sagging, or a roof over 20-25 years old usually points to replacement. We give you an honest recommendation either way.',
      },
      {
        q: 'How long does a roof replacement take?',
        a: 'Most residential roof replacements are completed in 1-3 days depending on size, material, and weather. We give you a clear timeline before we start.',
      },
      {
        q: 'What roofing materials do you install?',
        a: 'Asphalt shingles, metal, and tile. During your estimate we help you weigh cost, lifespan, and appearance to pick the best fit for your home and budget.',
      },
      {
        q: 'Do you offer free estimates?',
        a: 'Yes. Every roofing estimate is free with no obligation. Call (559) 833-6945 or request a quote online.',
      },
    ],
    materialsHeading: 'Roofing materials we install',
    materialsIntro:
      'We help you choose the right material for your home, your budget, and the Central Valley climate.',
    materials: [
      { icon: 'roof', name: 'Asphalt Shingle', text: 'The most popular, cost-effective choice. Architectural shingles in many colors, built to handle Central Valley heat.', illustration: '/illustrations/mat-shingle.svg' },
      { icon: 'shield', name: 'Metal Roofing', text: 'Long-lasting and energy efficient. Reflects heat, stands up to sun, and gives a clean, modern look.', illustration: '/illustrations/mat-metal.svg' },
      { icon: 'roof', name: 'Tile Roofing', text: 'Premium, extremely durable tile with a classic look and a very long lifespan.', illustration: '/illustrations/mat-tile.svg' },
    ],
    children: [
      {
        slug: 'residential-roofing',
        name: 'Residential Roofing',
        short: 'New roofs and full replacements for your home.',
        metaTitle: 'Residential Roofing in Fresno, CA | New Roofs & Replacement',
        metaDescription:
          'Residential roofing in Fresno and the Central Valley. New roof installation and full replacement in asphalt shingle, metal, and tile. Licensed CA #1129883. Free estimate, (559) 833-6945.',
        h1: 'Residential Roofing in Fresno, CA',
        intro:
          'From a full tear-off and replacement to a brand-new roof, we protect your home with quality materials built for the Central Valley climate, installed clean and on schedule with an honest, upfront price.',
        image: '/photos/projects/roof-fresno-tyler.jpg',
        imageAlt:
          'Finished charcoal architectural shingle roof on a Fresno, CA home, aerial view',
        highlights: [
          'Full roof replacement and new installation',
          'New underlayment, flashing, and ventilation',
          'Asphalt shingle, metal, or tile options',
          'Roofs built for Central Valley heat and sun',
          'Most homes finished in 1 to 3 days',
        ],
        body: [
          {
            heading: 'What a full replacement includes',
            text: 'A reroof done right is a system, not a layer of shingles. We tear the old roof off down to the decking, inspect every sheet, and replace any wood that is soft or damaged. Then we rebuild from the deck up: new underlayment, new flashing at every wall, valley, and penetration, balanced intake and exhaust ventilation, and finally the shingle, tile, or metal roof you chose. The job ends with a final walkthrough and photos of the finished work.',
          },
          {
            heading: 'What moves the price',
            text: 'Roofing is priced by the square (100 square feet of roof area). For most Fresno and Clovis homes, architectural shingle runs about $400 to $700 per square installed including tear-off of one layer, concrete tile about $800 to $1,200, and standing-seam metal about $800 to $1,400. Pitch matters too: a steeper roof has more area and slower, more careful work. Each extra existing layer to tear off adds about $75 to $150 per square, and hidden decking damage is the wild card no bid can promise away, which is why ours prices it as a clear line item before work continues. For a ballpark on your own roof, the instant estimate tool at /estimate/ uses these same brackets.',
          },
          {
            heading: 'How we run the job: The Smart Home Standard',
            text: 'Tear-off is the messy part of roofing, so before it starts we put down Home Shield protection: landscaping, your driveway, and anything below the eaves gets covered. The site is cleaned every day we are there, and the job ends with our Magnet-Swept Cleanup, a magnetic sweep of the yard and driveway so no nail is left behind. Your inspection and the finished roof are both photo-documented, so you see what we saw and what we built, not just a bill.',
          },
          {
            heading: 'Built for Climate Zone 13',
            text: 'Fresno sits in California Climate Zone 13, where summer heat bakes a roof for months and the occasional wet winter tests every flashing detail. That is why we quote cool-roof rated architectural shingles, insist on balanced attic ventilation, and detail valleys and penetrations carefully for the heavy rain that shows up a few times a year. Where Title 24 cool-roof requirements apply to your reroof, we handle that paperwork along with the permit.',
          },
        ],
        faqs: [
          {
            q: 'How much does a new roof cost in Fresno?',
            a: 'For most Fresno and Clovis homes, a full shingle roof replacement lands between about $8,000 and $18,000 installed; tile and standing-seam metal run higher. The exact number depends on roof size, pitch, layers to tear off, and decking condition, so we put it in a free itemized estimate. Want a ballpark first? Our instant estimate tool at /estimate/ shows your price range in 60 seconds, no contact info required.',
          },
          {
            q: 'Do you have to tear off the old shingles, or can you roof over them?',
            a: 'We recommend a full tear-off. It is the only way to inspect the decking and fix problems instead of burying them, and our per-square pricing already includes tearing off one layer. If your roof has more than one existing layer, each extra layer adds about $75 to $150 per square to remove, and we will see that during the free inspection so the quote is accurate.',
          },
          {
            q: 'How long will a new roof last?',
            a: 'A quality asphalt shingle roof typically lasts 20-25 years, while metal and tile can last longer. Proper installation and ventilation, which we always include, help you get the full lifespan.',
          },
          {
            q: 'What is a cool roof, and do I need one?',
            a: "A cool roof reflects more of the sun's heat instead of soaking it in, which matters through a Fresno summer. California's Title 24 energy code applies cool-roof requirements to many reroofs in our climate zone, so the architectural shingles we quote are cool-roof rated. It helps your attic temperature either way, and we sort out whether the requirement applies to your specific project as part of the permit.",
          },
          {
            q: 'What happens if you find damaged decking under the old roof?',
            a: 'It gets photographed and shown to you before we continue. Decking replacement is listed in your itemized quote as its own line item, so if we find soft or rotten wood you know exactly what replacing it costs. What we never do is roof over bad wood.',
          },
          {
            q: 'Will you clean up afterward?',
            a: 'Always. We protect your landscaping during the job and do a full cleanup and magnetic nail sweep when we finish.',
          },
        ],
      },
      {
        slug: 'roof-repair',
        name: 'Roof Repair',
        short: 'Fast, affordable fixes for leaks and damage.',
        metaTitle: 'Roof Repair in Fresno, CA | Leak Repair',
        metaDescription:
          'Fast roof repair in Fresno and the Central Valley. Fix leaks, missing shingles, and flashing with honest pricing. Licensed CA #1129883. Free estimate, (559) 833-6945.',
        h1: 'Roof Repair in Fresno, CA',
        intro:
          'A small roof problem can turn into a big one fast. We track down leaks, replace damaged or missing shingles, and repair flashing quickly, so your home stays protected without the cost of a full replacement.',
        image: '/photos/projects/roof-fresno-alta.jpg',
        imageAlt: 'Roof repair work in progress on a Fresno, CA home showing fresh underlayment',
        highlights: [
          'Leak detection and repair',
          'Shingle, flashing, and vent repairs',
          'Honest assessment of repair vs replacement',
          'Fast scheduling to stop further damage',
          'Affordable fixes with no surprises',
        ],
        body: [
          {
            heading: 'How a repair visit works',
            text: 'It starts with a free inspection. We walk the roof, check the attic side when it is accessible, and trace the water back to its real entry point, which is often uphill from the stain on your ceiling. You get photos of what we found and a written price before any work starts. Then we make the repair: replacing damaged or missing shingles, resealing or replacing flashing, swapping cracked vent boots, and closing up whatever path the water was using to get in.',
          },
          {
            heading: 'What a repair costs',
            text: 'There is no honest flat rate for roof repair, because the price depends on what is actually wrong: how far the water has traveled, how steep and accessible the roof is, and whether we are fixing one problem or several. What we can promise is the order of operations: inspection first, photos and a written price second, work third. A targeted repair costs a small fraction of a replacement, which is exactly why catching problems early pays off.',
          },
          {
            heading: 'An honest call every time',
            text: 'If a repair is the smart, affordable fix, that is what we recommend. If your roof is near the end of its life and repairs would be throwing money away, we will tell you that too, and you can get a replacement ballpark in about 60 seconds with the instant estimate tool at /estimate/ before you decide anything.',
          },
          {
            heading: 'How Valley roofs fail',
            text: 'Climate Zone 13 is hard on asphalt. Months of triple-digit sun dry out shingles and sealant, south- and west-facing slopes age fastest, and the swing between hot days and cool nights works flashing loose over time. Then a wet winter storm finds every gap at once. Granules collecting in your gutters, curled shingle edges, and stains that appear after the first big rain are the signals worth a free inspection.',
          },
        ],
        faqs: [
          {
            q: 'How soon can you repair my roof?',
            a: 'We prioritize active leaks and storm damage to prevent further harm to your home. Call (559) 833-6945 and we will get you scheduled quickly.',
          },
          {
            q: 'How much does a roof repair cost?',
            a: 'It depends on what is wrong. The main drivers are how far the water has traveled, how steep and accessible the roof is, and how many separate problems we find. Rather than guess, we inspect for free, show you photos of the issue, and put the price in writing before any work starts.',
          },
          {
            q: 'Is it worth repairing an older roof?',
            a: 'Sometimes. If the roof is generally sound, a targeted repair makes sense. If problems are widespread, we will give you an honest comparison of repair versus replacement.',
          },
          {
            q: 'Will the repair match my existing shingles?',
            a: 'We match the color and profile as closely as we can. On an older roof, years of Central Valley sun will have faded the original color, so a perfect match is not always possible. We show you the closest option before we start so there are no surprises.',
          },
          {
            q: 'Can you find a leak that only shows up in heavy rain?',
            a: 'Usually, yes. Water rarely drips straight down from where it enters, so we trace the path from the stain back up the roof, checking flashing, penetrations, and shingle condition along the way, and the attic side as well when it is accessible. You get photos of what we find either way.',
          },
          {
            q: 'Is the repair guaranteed?',
            a: 'Yes. Every job we do is backed by our Get-It-Right Guarantee: if something is not right, we make it right. If a repair we made does not hold, call us and we will take care of it.',
          },
        ],
      },
      {
        slug: 'siding',
        name: 'Siding',
        short: "Protect and refresh your home's exterior.",
        metaTitle: 'Siding Installation & Repair in Fresno, CA',
        metaDescription:
          'Siding installation and repair in Fresno and the Central Valley. Protect your home and boost curb appeal with durable, weather-ready siding. Free estimate, (559) 833-6945.',
        h1: 'Siding in Fresno, CA',
        intro:
          "New and repaired siding protects your home from sun, heat, and moisture while giving it a fresh, lasting look. We install and repair siding built to stand up to the Central Valley climate.",
        image: '/photos/gallery/work-10.jpg',
        imageAlt: 'Home exterior wall with fresh stucco siding and brick accents in Fresno, CA',
        highlights: [
          'Durable, weather-ready siding',
          'Improved curb appeal and home value',
          'Better protection from heat and moisture',
          'Repair of damaged or worn siding',
          'Clean, professional installation',
        ],
        body: [
          {
            heading: 'Protection and curb appeal',
            text: 'Your siding is your home’s first line of defense against the elements, and a big part of how it looks. We install quality siding that seals out moisture, stands up to Central Valley heat, and refreshes your home’s exterior.',
          },
          {
            heading: 'Repair or replace',
            text: 'Cracked, warped, or faded siding does not just look bad, it lets in heat and moisture. We will assess your siding and recommend targeted repairs or a full replacement, whatever makes the most sense for your home and budget.',
          },
        ],
        faqs: [
          {
            q: 'Do you repair siding or only replace it?',
            a: 'Both. If a section is damaged but the rest is sound, we can often repair it. When siding is widely worn or failing, we will recommend replacement and show you your options.',
          },
          {
            q: 'Does new siding help with energy efficiency?',
            a: 'Yes. Quality siding, especially when paired with proper insulation, helps seal your home against heat and air leaks, which can lower your energy bills.',
          },
        ],
      },
      {
        slug: 'storm-damage',
        name: 'Storm Damage',
        short: 'Fast repairs after wind and storm damage.',
        metaTitle: 'Storm Damage Roof Repair in Fresno, CA',
        metaDescription:
          'Storm and wind damage roof repair in Fresno and the Central Valley. Fast response to leaks and damage to protect your home. Licensed CA #1129883. Call (559) 833-6945.',
        h1: 'Storm Damage Repair in Fresno, CA',
        intro:
          'Wind, rain, and storms can damage your roof fast. We respond quickly to find and repair leaks and storm damage before they turn into costly problems inside your home.',
        image: '/photos/projects/roof-fresno-thesta.jpg',
        imageAlt: 'Storm-damaged roof being repaired on a Fresno, CA home',
        highlights: [
          'Fast response to active leaks',
          'Wind and storm damage repair',
          'Full damage inspection',
          'Help documenting the damage',
          'Honest repair vs replacement advice',
        ],
        body: [
          {
            heading: 'What to do right after a storm',
            text: 'Check your ceilings and attic for new stains, look at the roof from the ground for missing or lifted shingles, and stay off the roof itself. If water is coming in, move what you can out of the way and call us. We prioritize active leaks and storm calls, and the sooner the roof gets looked at, the less the water gets to do.',
          },
          {
            heading: 'How we handle a storm call',
            text: 'First we stop the bleeding: if water is actively getting in, securing that area comes before everything else. Then we inspect the whole roof, not just the obvious spot, because wind that lifted one shingle usually stressed others. Everything we find is photo-documented, so you see the damage exactly as we saw it, and you get a written scope and price for the permanent repair before we do it.',
          },
          {
            heading: 'Insurance claims, honestly',
            text: 'Our photo documentation and written scope give you and your adjuster a clear record of the damage. We will not inflate a claim or promise your deductible away, and any contractor who does should worry you. Often the smartest first step is knowing what the repair actually costs, so you can decide whether a claim is even worth filing.',
          },
          {
            heading: 'What Valley storms do to roofs',
            text: 'Our storms are not hurricanes, but the pattern here is sneaky: months of Climate Zone 13 heat leave shingles dry and brittle, then a winter wind event snaps or lifts them and wind-driven rain gets under the edges. Older roofs and south- and west-facing slopes are the usual victims. Damage from a single storm can be nearly invisible from the ground, which is why the inspection covers the whole roof.',
          },
        ],
        faqs: [
          {
            q: 'How fast can you respond to storm damage?',
            a: 'We prioritize active leaks and storm damage. Call (559) 833-6945 and we will get out to assess and protect your home as quickly as possible.',
          },
          {
            q: 'Water is coming in right now. What should I do?',
            a: 'Move belongings out of the way, put a container under the drip, and if water is pooling in a ceiling bubble, relieve it with a small hole so the drywall does not come down all at once. Then call (559) 833-6945. Securing the leak comes first; the permanent repair follows once the roof is dry and you have approved the written scope.',
          },
          {
            q: 'Should I file an insurance claim for roof damage?',
            a: 'It depends on the numbers. If the repair costs less than or close to your deductible, filing usually does not make sense. That is why we give you a written repair price first: with a real number in hand, you and your insurer can make the call. We document everything with photos either way.',
          },
          {
            q: 'Can you help with my insurance claim?',
            a: 'We can inspect the damage and help document it for your records. We will give you an honest assessment of what needs to be repaired or replaced.',
          },
          {
            q: 'How do I know if my roof was damaged if nothing is leaking?',
            a: 'Look for shingle pieces or granules in the yard and gutters, lifted or flapping shingle edges, and anything metal that is bent. Wind damage often does not leak until the next storm hits. If anything looks off from the ground, a free inspection with photos settles it without you climbing a ladder.',
          },
          {
            q: 'Is one missing shingle really a problem?',
            a: 'Left alone, yes. The underlayment beneath it is not made for months of direct Central Valley sun, and once it degrades, the next rain has a straight path to the decking. A one-shingle repair now is one of the cheapest fixes in roofing.',
          },
        ],
      },
      {
        slug: 'commercial-roofing',
        name: 'Commercial Roofing',
        short: 'Roofing for businesses and commercial property.',
        metaTitle: 'Commercial Roofing in Fresno, CA',
        metaDescription:
          'Commercial roofing in Fresno and the Central Valley. Installation, repair, and flat and low-slope roofing for businesses. Licensed CA #1129883. Free estimate, (559) 833-6945.',
        h1: 'Commercial Roofing in Fresno, CA',
        intro:
          'Protect your business with durable commercial roofing built for the Central Valley. We handle installation, repair, and flat and low-slope systems with minimal disruption to your operations.',
        image: '/photos/projects/roof-fresno-farris.jpg',
        imageAlt: 'Large commercial-style roof in Fresno, CA, aerial view',
        highlights: [
          'Flat and low-slope roofing systems',
          'Commercial repair and replacement',
          'Durable, weather-ready materials',
          'Minimal disruption to your business',
          'Licensed, experienced crews',
        ],
        body: [
          {
            heading: 'Built for your business',
            text: 'A commercial roof protects your building, your inventory, and your operations. We install and replace flat and low-slope roofing systems built to handle Central Valley heat and weather, with a clean, efficient process.',
          },
          {
            heading: 'Repair and maintenance',
            text: 'Small problems on a commercial roof get expensive fast. We repair leaks and damage and offer maintenance that extends the life of your roof and protects what is underneath.',
          },
        ],
        faqs: [
          {
            q: 'What types of commercial roofs do you work on?',
            a: 'We work on flat and low-slope commercial roofing systems. Call (559) 833-6945 to discuss your building and the best option for it.',
          },
          {
            q: 'Can you work around our business hours?',
            a: 'Yes. We plan the work to minimize disruption to your operations and keep the site clean and safe throughout.',
          },
        ],
      },
    ],
  },

  windows: {
    slug: 'windows',
    name: 'Windows',
    icon: 'window',
    metaTitle: 'Window Replacement & Repair in Fresno, CA | Energy Efficient',
    metaDescription:
      'Energy-efficient window replacement and repair in Fresno and the Central Valley. Lower bills, less noise, more curb appeal. Licensed CA #1129883. Free quote, (559) 833-6945.',
    summary:
      'Anlin replacement windows (built in Clovis, double lifetime warranty) and honest window repair that cuts bills and blocks noise.',
    hero: {
      eyebrow: 'Windows',
      title: 'Window replacement and repair',
      intro:
        "Window work comes down to two jobs, and we do both. When it is time to upgrade, we install Anlin windows, built in Clovis about 15 minutes from us and backed by a double lifetime transferable warranty; the replacement page covers styles, Title 24, and real Fresno pricing. When a window just needs fixing, our repair page covers foggy glass, drafts, and hardware. Not sure which you need? The free assessment answers that honestly.",
    },
    image: '/photos/windows/windows-hero.jpg',
    cardImage: '/photos/projects/windows-fresno-grove.jpg',
    cardImageAlt: 'Finished sliding window installation with clean white trim in Fresno, CA',
    imageAlt:
      'New white vinyl replacement window installed by Smart Home Improvements on a Visalia, CA home',
    heroIllustration: '/illustrations/windows-hero.svg',
    featureIllustration: '/illustrations/window-cutaway.svg',
    offerings: [
      {
        icon: 'wrench',
        title: 'Window Repair',
        text: 'Foggy glass, drafts, and hardware that will not cooperate. The Window Repair page covers what can be fixed and when replacement is smarter.',
      },
      {
        icon: 'window',
        title: 'Window Replacement',
        text: 'New energy-efficient windows, custom fit to your openings. The Window Replacement page covers styles, cost drivers, and Title 24.',
      },
      {
        icon: 'leaf',
        title: 'Energy-Efficient Options',
        text: 'Double and triple glazing with Low-E coatings that keep you cooler in summer and warmer in winter.',
      },
    ],
    benefits: [
      'Lower heating and cooling bills',
      'Reduced outside noise for a quieter home',
      'Improved comfort with fewer drafts and hot spots',
      'Increased curb appeal and resale value',
      'Custom styles and materials to match your home',
    ],
    faqs: [
      {
        q: 'Will new windows really lower my energy bills?',
        a: 'Yes. Energy-efficient windows with Low-E coatings and double or triple glazing reduce heat gain in summer and heat loss in winter, easing the load on your HVAC system. Many homeowners see noticeably lower bills.',
      },
      {
        q: 'Can you match the style of my existing windows?',
        a: 'Absolutely. We offer a wide range of styles and materials and help you choose options that fit your home, function, and budget.',
      },
      {
        q: 'Do you repair windows or only replace them?',
        a: 'Both. If a repair makes sense (broken glass, a failed seal, hardware issues), we will do that. When windows are beyond repair, we will recommend replacement.',
      },
      {
        q: 'How long does window installation take?',
        a: 'Most window projects are completed in a day or two depending on the number of windows. We give you a clear schedule up front.',
      },
    ],
    materialsHeading: 'Window styles we install',
    materialsIntro: 'Choose from a wide range of styles and finishes to match your home.',
    materials: [
      { icon: 'window', name: 'Double & Single Hung', text: 'Classic, easy to clean and ventilate, a great fit for most homes.', illustration: '/illustrations/mat-win-hung.svg' },
      { icon: 'window', name: 'Sliders & Casements', text: 'Horizontal sliders for wide views and crank-out casements for airflow.', illustration: '/illustrations/mat-win-slider.svg' },
      { icon: 'window', name: 'Picture, Bay & Bow', text: 'Large fixed and projecting windows that add light, space, and character.', illustration: '/illustrations/mat-win-bay.svg' },
    ],
    children: [
      {
        slug: 'window-replacement',
        name: 'Window Replacement',
        short: 'Energy-efficient windows that cut bills and noise.',
        metaTitle: 'Window Replacement in Fresno, CA | Energy-Efficient Windows',
        metaDescription:
          'Energy-efficient window replacement in Fresno and the Central Valley. Lower bills, less noise, more curb appeal, custom styles. Free quote, (559) 833-6945.',
        h1: 'Window Replacement in Fresno, CA',
        intro:
          "Upgrading to new energy-efficient windows is one of the best ways to cut your energy bills and boost your home's comfort and value. We install custom-fit vinyl windows with Low-E glass that stand up to Central Valley summers.",
        image: '/photos/windows/windows-hero.jpg',
        imageAlt: 'New white vinyl grid replacement window on a Visalia, CA home',
        highlights: [
          'Energy-efficient Low-E, double and triple glazing',
          'Custom-fit for a tight, weatherproof seal',
          'Lower energy bills and fewer drafts',
          'Less outside noise and more curb appeal',
          'A wide range of styles and finishes',
        ],
        body: [
          {
            heading: 'Built for Climate Zone 13 summers',
            text: 'Fresno sits in California Climate Zone 13, where the cooling season is long and the glass is where the heat gets in. Old or failing windows let heat pour through all summer and leak it back out in winter, and your AC pays for both. Our replacement windows use dual-pane Low-E glass that blocks solar heat before it enters the room, which is also what the Title 24 energy code requires of replacement windows here.',
          },
          {
            heading: 'How the process works',
            text: 'It starts with a free in-home assessment: we measure every opening, check frames and seals, and give you a written, itemized quote with no same-day-discount games. Your windows are built to order and typically arrive a few weeks after measurement. On install day we protect your floors and landscaping before the first window comes out, set each new window with a tight, weatherproof seal, and finish the exterior and interior lines cleanly. Each opening is only open to the outside for a short time, and the finished work is photo-documented.',
          },
          {
            heading: 'What moves the price',
            text: 'Standard vinyl retrofit windows in the Fresno area run about $750 to $1,500 per window installed, premium Anlin windows about $1,100 to $2,200, and large picture, bay, and specialty shapes $2,500 to $5,000. Beyond the window itself, the price moves with the glass package (tempered where code requires it, sound-dampening near busy streets), second-story access, and whether your openings need retrofit inserts or full-frame replacement, which adds roughly 30 to 50 percent for stucco work. The instant estimate tool at /estimate/ turns your window count into a range in about 60 seconds.',
          },
          {
            heading: 'Why we install Anlin',
            text: 'We install Anlin windows, built in Clovis about 15 minutes from us, with a double lifetime warranty that transfers to the next owner of your home. A local manufacturer matters if a screen or a glass unit ever needs service, and a transferable warranty is a real selling point on a Valley home. During the assessment we show you exactly what separates the standard and premium lines so you can decide with real numbers.',
          },
        ],
        faqs: [
          {
            q: 'How much do replacement windows cost?',
            a: 'Most standard vinyl retrofit windows in the Fresno area run about $750 to $1,500 per window installed, and premium Anlin windows about $1,100 to $2,200, depending on size, style, and glass package. A typical 10 to 12 window home lands between roughly $9,000 and $28,000. Use the instant estimate tool at /estimate/ for your range in 60 seconds, then the free in-home assessment turns it into an exact written quote.',
          },
          {
            q: 'What window styles do you offer?',
            a: 'Single and double hung, sliders, picture windows, casements, and more, in a range of finishes to match your home.',
          },
          {
            q: 'What is the difference between retrofit and full-frame replacement?',
            a: 'Retrofit (insert) windows install inside your existing frame, which keeps the stucco intact and keeps cost down, and nearly every Fresno stucco home is a candidate. Full-frame replacement removes everything down to the rough opening and typically adds 30 to 50 percent for stucco cutting, patching, and paint. It is only necessary when the old frame is rotted or badly out of square, and the free assessment tells you which situation you have.',
          },
          {
            q: 'Do I need a permit to replace windows in Fresno or Clovis?',
            a: 'Yes. Like-for-like window replacement requires a permit in both the City of Fresno and the City of Clovis, and the new windows must meet the current California energy code (Title 24). We handle the permit and the paperwork for you. If a bid is cheap because nobody pulls a permit, that becomes your problem at resale and with your insurance.',
          },
          {
            q: 'How long does whole-home window replacement take?',
            a: 'Once your windows arrive from the manufacturer, typically a few weeks after measurement, a 10 to 12 window retrofit install usually takes our crew 1 to 2 days. Each opening is only open to the outside for a short time, so your home is never left exposed overnight.',
          },
          {
            q: 'Are there rebates or tax credits for new windows?',
            a: 'The federal 25C energy-efficiency tax credit covers 30 percent of the cost of qualifying ENERGY STAR windows, up to $600 per year. Utility programs change year to year, so ask what is active when you get your assessment. We include the qualifying paperwork details in your quote.',
          },
          {
            q: 'What brand of windows do you install?',
            a: 'We install Anlin, a premium vinyl window built in Clovis with a double lifetime warranty that transfers to the next owner of your home. During your free assessment we walk you through the standard and premium options and what each one costs for your openings.',
          },
        ],
      },
      {
        slug: 'window-repair',
        name: 'Window Repair',
        short: 'Fix drafts, broken glass, and failed seals.',
        metaTitle: 'Window Repair in Fresno, CA | Glass & Seal Repair',
        metaDescription:
          'Window repair in Fresno and the Central Valley. Fix broken glass, failed seals, drafts, and hardware. Licensed CA #1129883. Free estimate, (559) 833-6945.',
        h1: 'Window Repair in Fresno, CA',
        intro:
          'Damaged or drafty windows raise your energy bills and hurt your comfort and security. When a repair makes sense, we fix broken glass, failed seals, and faulty hardware quickly and affordably.',
        image: '/photos/projects/windows-fresno-ivy.jpg',
        imageAlt: 'Repaired and replaced white vinyl window on a Fresno, CA home',
        highlights: [
          'Broken and foggy glass replacement',
          'Failed seal and weatherstripping repair',
          'Hardware, lock, and balance fixes',
          'Draft and air-leak sealing',
          'Honest repair vs replacement advice',
        ],
        body: [
          {
            heading: 'Fix the problem, not just the symptom',
            text: 'Foggy glass usually means a failed seal, drafts usually mean worn weatherstripping or a poor original fit, and a window that will not stay open usually has a failed balance. We diagnose the actual cause, show you what we found, and repair it with quality parts so it stays fixed instead of patching the symptom.',
          },
          {
            heading: 'What a repair visit covers',
            text: 'We check the glass unit and its seal, the weatherstripping, the rollers, balances, locks, and latches, and the condition of the frame itself. Many fixes happen in one visit. When the insulated glass unit has failed, we measure it, order the replacement glass, and swap it into your existing frame on a return trip, which restores the window at a fraction of the cost of replacing it.',
          },
          {
            heading: 'What moves the price',
            text: 'Repair pricing depends on the part: glass size and type (the building code requires tempered glass near doors, floors, and tubs), whether hardware for an older window is still made, and how many windows need attention. There is no honest flat rate, so we look first and put the price in writing. When a repair starts approaching the cost of a standard replacement window, about $750 to $1,500 installed, we tell you plainly and let you choose.',
          },
          {
            heading: 'When repair is not the smart money',
            text: 'Single-pane aluminum windows are the honest exception. The frames conduct heat straight into the house, there is no failed seal to restore, and in a Climate Zone 13 summer they are hot to the touch by noon. We can service their hardware, but we will not pretend a repair fixes what they fundamentally are. If that is what your home has, the free assessment lays out both paths, repair and replacement, with no pressure.',
          },
        ],
        faqs: [
          {
            q: 'Can you replace just the glass?',
            a: 'In many cases, yes. If the frame is sound and only the glass or seal has failed, a glass replacement can restore the window at a lower cost than a full replacement.',
          },
          {
            q: 'Why are my windows foggy between the panes?',
            a: 'That fog is condensation from a failed seal in a double-pane window. We can replace the glass unit to clear it up and restore efficiency.',
          },
          {
            q: 'Is it cheaper to repair or replace a window?',
            a: 'A repair is almost always cheaper on the day, especially a glass swap in a sound vinyl frame. Replacement wins when the frame itself has failed, the window is single-pane aluminum, or repair costs start approaching the roughly $750 to $1,500 installed cost of a standard replacement window. When it is close, we quote both and you choose.',
          },
          {
            q: 'Can you fix a window that sticks, will not lock, or slams shut?',
            a: 'Usually, yes. Those are hardware problems: worn rollers, failed balances, or misaligned locks. Most are quick fixes once the right part is in hand. If parts for a discontinued window no longer exist, we will tell you honestly before anything comes apart and go from there.',
          },
          {
            q: 'Why does my room still get hot with the window closed?',
            a: 'Closed is not the same as sealed. Worn weatherstripping and failed glass seals let hot outside air and radiant heat through all summer, and in Fresno that shows up on your PG&E bill. A repair that restores the seal helps. If the window is single-pane, the glass itself is the bigger problem and we will say so.',
          },
          {
            q: 'How soon can you come out?',
            a: 'Broken glass is a security problem, so we prioritize it. Call (559) 833-6945 to get scheduled. Our office answers Monday - Friday, 9:00 AM - 7:00 PM and Saturday, 9:00 AM - 6:00 PM.',
          },
        ],
      },
    ],
  },

  insulation: {
    slug: 'insulation',
    name: 'Insulation',
    icon: 'insulation',
    metaTitle: 'Home Insulation in Fresno, CA | Attic & Radiant Barrier',
    metaDescription:
      'Attic insulation and radiant barrier installation in Fresno and the Central Valley. Save about 15% on heating and cooling costs (per ENERGY STAR estimates) and stay comfortable year-round. Free quote, (559) 833-6945.',
    summary:
      'Attic insulation and radiant barriers that cut energy bills and keep every room comfortable year-round.',
    hero: {
      eyebrow: 'Insulation',
      title: 'Insulation that cuts energy bills',
      intro:
        "Two upgrades do most of the work in a Central Valley attic: attic insulation, which slows heat transfer year-round, and a radiant barrier, which reflects summer heat before it gets in. Each has its own page below with the process, the cost drivers, and honest answers, and a free assessment tells you which one your home actually needs.",
    },
    image: '/photos/insulation/insulation-hero.jpg',
    imageAlt: 'Illustration of attic insulation keeping a Central Valley home comfortable and energy efficient',
    heroIllustration: '/illustrations/insulation-hero.svg',
    featureIllustration: '/illustrations/insulation-cutaway.svg',
    offerings: [
      {
        icon: 'insulation',
        title: 'Attic Insulation',
        text: 'The year-round workhorse of home efficiency. The Attic Insulation page covers how the job goes and what moves the price.',
      },
      {
        icon: 'wrench',
        title: 'Insulation Replacement',
        text: 'Compressed, damaged, or moisture-affected insulation removed and replaced, covered on the Attic Insulation page.',
      },
      {
        icon: 'leaf',
        title: 'Radiant Barriers',
        text: 'The summer specialist for our climate. The Radiant Barrier page covers how it works and which homes benefit most.',
      },
    ],
    benefits: [
      'Save about 15% on heating and cooling costs (ENERGY STAR estimate)',
      'Consistent, comfortable temperatures in every room',
      'Reduced strain on your HVAC system',
      'Improved indoor air quality',
      'A more energy-efficient, eco-friendly home',
    ],
    faqs: [
      {
        q: 'How much can insulation save me on energy bills?',
        a: 'ENERGY STAR estimates homeowners save about 15% on heating and cooling costs by air sealing and adding attic insulation. Actual savings depend on your current insulation, home size, and the upgrades you choose, which is exactly what our free assessment measures.',
      },
      {
        q: 'What types of insulation do you install?',
        a: 'Attic insulation, wall insulation, and radiant barriers. During a free assessment we identify the problem areas and recommend the best solution for your home.',
      },
      {
        q: 'How do I know if my insulation needs replacing?',
        a: 'Signs include uneven room temperatures, drafts, rising energy bills, and insulation that is old, compressed, or moisture-damaged. We will assess it and give you an honest recommendation.',
      },
      {
        q: 'Is a radiant barrier worth it in the Central Valley?',
        a: 'Yes. With our hot summers, radiant barriers deflect heat before it enters your attic, helping keep your home cooler and reducing AC costs.',
      },
    ],
    materialsHeading: 'Insulation we install',
    materialsIntro: 'We install the right type and depth of insulation for your home and your goals.',
    materials: [
      { icon: 'insulation', name: 'Attic & Wall Insulation', text: 'Stops heat loss and gain where it matters most for year-round comfort.', illustration: '/illustrations/mat-ins-batt.svg' },
      { icon: 'leaf', name: 'Radiant Barriers', text: 'Reflective barriers that deflect summer heat before it enters your attic.', illustration: '/illustrations/mat-ins-radiant.svg' },
      { icon: 'insulation', name: 'Blown-In & Batt', text: 'Even coverage in hard-to-reach areas, plus batt insulation for attics and walls.', illustration: '/illustrations/mat-ins-blown.svg' },
    ],
    children: [
      {
        slug: 'attic-insulation',
        name: 'Attic Insulation',
        short: 'Stop heat loss and cut energy bills.',
        metaTitle: 'Attic Insulation in Fresno, CA | Energy Savings',
        metaDescription:
          'Attic insulation installation and replacement in Fresno and the Central Valley. Cut energy bills, end drafts, and stay comfortable. Free quote, (559) 833-6945.',
        h1: 'Attic Insulation in Fresno, CA',
        intro:
          'Your attic is where most of your home gains and loses heat. Proper attic insulation keeps conditioned air where it belongs, cuts your energy bills, and makes every room more comfortable through the Central Valley seasons.',
        image: '/photos/insulation/attic-insulation.jpg',
        imageAlt: 'Illustration of attic insulation batts holding heat inside a home',
        highlights: [
          'Save about 15% on heating and cooling',
          'End drafts and uneven room temperatures',
          'Reduce strain on your HVAC system',
          'Improve indoor comfort and air quality',
          'New installation or replacement of old insulation',
        ],
        body: [
          {
            heading: 'The highest-impact efficiency upgrade',
            text: 'Heat rises in winter and pushes down from a baking attic in summer, and an under-insulated attic loses that fight in both directions. Adding or upgrading attic insulation is one of the most cost-effective ways to lower your energy bills and even out temperatures across your home, and with PG&E rates what they are, wasted conditioned air is expensive air.',
          },
          {
            heading: 'How the job goes',
            text: 'It starts with a free assessment: we get into the attic, measure the depth and condition of what is there, photograph the problem areas, and check for the big air gaps around penetrations, because sealing plus insulation is what produces the real savings. If the old insulation is compressed, moisture-damaged, or contaminated, it comes out first, and we cover the route to your attic hatch before any material moves through the house (that is our Home Shield standard). Then we install blown-in or batt insulation to the right depth for our climate zone and photo-document the finished coverage, since your attic is the one part of the job you will probably never climb up to see.',
          },
          {
            heading: 'What moves the price',
            text: 'There is no one-size price for attic insulation, and we will not invent one. The honest drivers are attic size, whether we are topping up or removing and replacing, the material and depth we are adding, and how easy the attic is to work in. The free assessment turns those variables into a written, itemized quote, and if a smaller job gets you most of the benefit, that is what we will recommend.',
          },
          {
            heading: 'Made for Climate Zone 13',
            text: 'Fresno, Clovis, and Madera sit in California Climate Zone 13, with a long, hot cooling season and chilly, foggy winter nights, and your attic takes the brunt of both. Insulation slows that heat transfer year-round, and it pairs naturally with a radiant barrier, which reflects summer heat before it ever reaches the insulation. Many Valley attics benefit most from the combination, which is exactly what the assessment sorts out.',
          },
        ],
        faqs: [
          {
            q: 'How do I know if my attic needs more insulation?',
            a: 'Rooms that never feel comfortable, rising energy bills, and an attic where you can see the joists are all signs. A free assessment tells you for sure.',
          },
          {
            q: 'Can you add insulation over what I already have?',
            a: 'Often, yes, if the existing insulation is dry and in good shape. If it is compressed, damaged, or moldy, we will recommend removing and replacing it.',
          },
          {
            q: 'How much does attic insulation cost?',
            a: 'It depends on the attic: its size, whether old material has to come out, the type and depth of insulation we are adding, and how workable the space is. Rather than quote a made-up average, we measure your attic during a free assessment and give you a written, itemized price. Call (559) 833-6945 to set it up.',
          },
          {
            q: 'How much will I save on my energy bills?',
            a: 'ENERGY STAR estimates homeowners save about 15% on heating and cooling costs by air sealing and adding attic insulation. That estimate covers sealing and insulation together, which is why our assessment looks for air leaks as well as thin spots. Your actual number depends on your current insulation, your home, and how hard your AC works in summer.',
          },
          {
            q: 'Does attic insulation help more in summer or winter?',
            a: 'In the Central Valley, summer is where you feel it most. The attic soaks up sun all day and pushes that heat down into your rooms just as the afternoon peak hits, and insulation slows that transfer so your AC cycles less. In winter it works in reverse, holding furnace heat in through our cold, foggy nights.',
          },
          {
            q: 'What type of insulation do you install in attics?',
            a: "Blown-in insulation for even coverage across joists and into hard-to-reach corners, and batts where they make more sense. The right choice depends on your attic's framing, access, and what is already there, which is what the free assessment determines.",
          },
        ],
      },
      {
        slug: 'radiant-barrier',
        name: 'Radiant Barrier',
        short: 'Deflect summer heat before it enters.',
        metaTitle: 'Radiant Barrier Installation in Fresno, CA',
        metaDescription:
          'Radiant barrier installation in Fresno and the Central Valley. Deflect attic heat, keep your home cooler, and lower AC costs. Free quote, (559) 833-6945.',
        h1: 'Radiant Barrier in Fresno, CA',
        intro:
          'In the Central Valley, attic temperatures can soar in summer and push that heat down into your living space. A radiant barrier reflects that heat away before it gets in, helping keep your home cooler and your AC costs lower.',
        image: '/photos/insulation/radiant-barrier.jpg',
        imageAlt: 'Illustration of a radiant barrier reflecting the sun away from a home roof',
        highlights: [
          'Reflects radiant heat away from your living space',
          'Keeps upstairs and west-facing rooms cooler',
          'Lowers summer AC costs',
          'Pairs well with attic insulation',
          'Ideal for the Central Valley climate',
        ],
        body: [
          {
            heading: 'Made for Central Valley summers',
            text: 'A radiant barrier is a reflective layer installed in your attic that bounces the radiant heat of the sun back out instead of letting it soak into your home. On the hottest days, that can make a real difference in how cool and comfortable your home stays.',
          },
          {
            heading: 'How installation works',
            text: 'We start in your attic with a free assessment, checking the framing, ventilation, and existing insulation, because a radiant barrier is one piece of a system. The barrier is then installed at the roofline with its reflective surface facing an air gap, which is what lets it reflect heat instead of conducting it, fitted carefully around vents, wiring, and framing. The finished coverage is photo-documented, so you can see exactly what was installed in a space you will likely never inspect yourself.',
          },
          {
            heading: 'Better together with insulation',
            text: 'Radiant barriers and attic insulation do different jobs. Insulation slows heat transfer, while a radiant barrier reflects radiant heat away. Used together, they give you the biggest gain in summer comfort and energy savings.',
          },
          {
            heading: 'What moves the price, and who benefits most',
            text: 'Price follows the attic: its size, how cut up the roofline is with hips and valleys, and how easy the space is to move through. We put the number in a written quote after the free assessment rather than guessing. The homes that benefit most are the ones that suffer most in July: two-story homes with hot upstairs rooms, west-facing exposures, and homes with AC ducts running through the attic, where a cooler attic means the system is not fighting its own environment.',
          },
        ],
        faqs: [
          {
            q: 'Does a radiant barrier really help in Fresno?',
            a: 'Yes. Our long, hot summers are exactly where radiant barriers shine, cutting attic heat gain and easing the load on your air conditioner.',
          },
          {
            q: 'Do I still need attic insulation if I add a radiant barrier?',
            a: 'Yes. They work together. Insulation slows heat transfer year-round, and the radiant barrier reflects summer heat. We will recommend the right combination for your home.',
          },
          {
            q: 'How much does a radiant barrier cost?',
            a: 'It depends on the attic: square footage, how complex the roofline is, and how workable the space is. We measure it during a free assessment and give you a written price, often alongside an attic insulation option so you can compare the two or combine them. Call (559) 833-6945 to schedule.',
          },
          {
            q: 'Does a radiant barrier help in winter?',
            a: "Its main job is summer. A radiant barrier reflects the sun's radiant heat, which is the problem Climate Zone 13 actually has for most of the year. Winter comfort comes mostly from insulation, which is why we treat the two as partners rather than substitutes.",
          },
          {
            q: 'Will it help my air conditioner and ducts?',
            a: 'If your AC ducts run through the attic, that is one of the strongest cases for a barrier. Every degree the attic drops is a degree your ducts are not fighting as they carry cold air across it. A cooler attic also means the AC cycles less through the late afternoon, the hottest part of the day.',
          },
          {
            q: 'Can you install a radiant barrier and insulation at the same time?',
            a: 'Yes, and it is often the most efficient way to do it: one assessment, one crew, one trip through your attic. The assessment will tell you honestly whether your home needs both or whether one gets you most of the benefit.',
          },
        ],
      },
    ],
  },
};

export const services = Object.values(serviceContent);
