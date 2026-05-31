import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/login', '/register', '/privacy'],
      disallow: [
        '/feed',
        '/closet',
        '/ai-stylist',
        '/onboarding',
        '/outfit',
        '/profile',
        '/travel-pack',
        '/api/'
      ],
    },
    sitemap: 'https://elephante.app/sitemap.xml',
  }
}
