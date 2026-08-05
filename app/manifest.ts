import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Bongómælir',
    short_name: 'Bongó',
    description: 'Óvísindalega vísindalegur mælikvarði á bongó veður á Íslandi.',
    lang: 'is',
    start_url: '/',
    display: 'standalone',
    background_color: '#fff7df',
    theme_color: '#ffb000',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  };
}
