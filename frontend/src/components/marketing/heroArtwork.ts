/** Shared responsive hero URLs let the home route start its image while CMS copy loads. */
export const heroArtworkUrl = '/assets/minimal-study-hero.webp';
export const heroArtworkSources = '/assets/minimal-study-hero-1280.webp 1280w, /assets/minimal-study-hero.webp 1672w';
export const heroArtworkMedia = '(min-width: 1024px)';
export function preloadHeroArtwork() {
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'image';
  link.type = 'image/webp';
  link.href = heroArtworkUrl;
  link.imageSrcset = heroArtworkSources;
  link.imageSizes = '100vw';
  link.media = heroArtworkMedia;
  link.fetchPriority = 'high';
  document.head.append(link);
  return () => link.remove();
}
