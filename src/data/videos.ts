// YouTube content (Shorts) from @SmartHome_Improvements.
// Add new videos here (id = the YouTube video ID) and they appear in the
// galleries automatically.

export const youtubeChannel = 'https://www.youtube.com/@SmartHome_Improvements';

export interface Video {
  id: string;
  title: string;
  // tag drives where it shows: a service slug ('windows', 'roofing',
  // 'insulation') or 'brand' for general clips.
  tag: 'windows' | 'roofing' | 'insulation' | 'brand';
  // Self-hosted vertical clip: when src is set the gallery renders a native
  // <video> (with poster) instead of a YouTube embed; id is just a unique key.
  src?: string;
  poster?: string;
}

export const videos: Video[] = [
  { id: 'local-roofing-testimonial', title: 'Roofing customer testimonial, Central Valley', tag: 'roofing', src: '/videos/roofing-testimonial.mp4', poster: '/videos/roofing-testimonial-poster-480.webp' },
  { id: 'Mh0RVJ8cngA', title: 'Window install testimonial', tag: 'windows' },
  { id: 'HF12v-jNTU4', title: 'Window to sliding door conversion in Fresno, CA', tag: 'windows' },
  // 'TY_EsJmvOec' removed: meme-overlay Short, wrong tone as a proof asset on
  // landing pages and the About gallery. Re-add real job/testimonial Shorts here.
  { id: 'YOOMJcjO3tA', title: 'On the job with Smart Home Improvements', tag: 'brand' },
];

export const videosFor = (tag: string) => videos.filter((v) => v.tag === tag);

// Local VSL videos (self-hosted) per service. When present, the landing page
// VSL section plays this instead of a YouTube Short. `vertical` marks 9:16
// phone footage so the player keeps its shape instead of cropping to 16:9.
export const localVsl: Partial<
  Record<'roofing' | 'windows' | 'insulation', { src: string; poster: string; title: string; transcript?: string; vertical?: boolean }>
> = {
  roofing: {
    src: '/videos/roofing-testimonial.mp4',
    poster: '/videos/roofing-testimonial-poster-480.webp',
    title: 'Roofing customer testimonial, Central Valley',
    vertical: true,
    // Real transcript of the video audio (Whisper speech-to-text). AEO: text
    // AI systems can read alongside the video.
    transcript:
      'We found Smart Home through Instagram. The process was really, really easy. The roof was bad. The good thing is no money was needed to be put down, and now the roof looks amazing. If you are going to replace your roof, do it once, do it right, do it the smart way.',
  },
  windows: {
    src: '/videos/windows-vsl.mp4',
    poster: '/videos/windows-vsl-poster-800.webp',
    title: 'Anlin window installation for the Trejo family',
    // Real transcript of the video audio (Whisper speech-to-text, proper
    // nouns corrected). AEO: text AI systems can read alongside the video.
    transcript:
      'Hey Central Valley, if you are thinking about replacing your windows, here is why so many people are choosing Smart Home Improvements to install Anlin windows. Every Anlin window is backed by their double lifetime warranty. For as long as you own your home you are covered, and if you ever sell, the new homeowner will be covered as well. But Anlin offers more than just an awesome warranty. It also gives you a quieter home, energy efficiency, comfort all year round, all while making your home look much more beautiful. And if your son breaks the glass with a baseball, or your landscaper with a weed trimmer, Anlin will replace the glass at no cost to you under their warranty. So if you are ready to upgrade your home with Anlin windows, contact us today.',
  },
};
