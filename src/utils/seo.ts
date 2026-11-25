import { APP_CONFIG, resolveVerificationToken } from '../config/appConfig';
import { HOW_IT_WORKS_FAQS, HOW_IT_WORKS_STEPS } from '../data/faqs';
import { getGuideBySlug, GUIDES } from '../data/guides';

export interface HeadMetaData {
  title: string;
  description: string;
  canonicalUrl: string;
  robots: string;
  ogType: 'website' | 'article';
  ogImage: string;
  schemas: Record<string, unknown>[];
  publishedTime?: string;
  modifiedTime?: string;
}

export const WATERMARK_MAKER_STEPS = [
  {
    name: 'Enter your channel handle or stamp text',
    text: 'Type your handle or crew name and choose Condensed, Stencil, or Mono typography with uppercase and letter-spacing options.',
  },
  {
    name: 'Adjust contrast outline, size, and drop shadow',
    text: 'Tune font size, dark stroke outline thickness, and drop shadow blur on the checkerboard transparency preview.',
  },
  {
    name: 'Download PNG or send straight to the editor',
    text: 'Export a pre-trimmed transparent PNG watermark or click Send to Editor to load it directly into your active video project.',
  },
];

export function normalizeRoutePath(pathname: string): string {
  const clean = pathname.split('?')[0].split('#')[0] || '/';
  if (clean !== '/' && clean.endsWith('/')) {
    return clean.slice(0, -1);
  }
  return clean;
}

export function buildAbsoluteUrl(pathname: string): string {
  const normalized = normalizeRoutePath(pathname);
  if (normalized === '/') {
    return `${APP_CONFIG.SITE_URL}/`;
  }
  return `${APP_CONFIG.SITE_URL}${normalized}`;
}

function clampText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const trimmed = text.slice(0, maxLength - 1).trimEnd();
  return `${trimmed}…`;
}

function buildBreadcrumbSchema(items: Array<{ name: string; path: string }>): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: item.name,
      item: buildAbsoluteUrl(item.path),
    })),
  };
}

export function getAllIndexableRoutes(): string[] {
  return [
    '/',
    '/editor',
    '/templates',
    '/watermark-maker',
    '/guides',
    ...GUIDES.map((g) => `/guides/${g.slug}`),
    '/how-it-works',
    '/about',
    '/privacy',
    '/terms',
    '/contact',
  ];
}

export function getHomeFeatureList(enableAutoCaptions = APP_CONFIG.ENABLE_AUTO_CAPTIONS): string[] {
  return [
    'Fast stream-copy video trimming (-c copy)',
    'Multi-clip segment queue with sequential or .ZIP batch export',
    '9:16, 1:1, 4:5, and 16:9 aspect presets for YouTube Shorts, TikTok, Instagram Reels, and Facebook Reels',
    'Blurred-background fill and Smart follow motion reframing',
    'Gameplay + Facecam split layout with draggable source boxes',
    enableAutoCaptions
      ? 'Smart Moments audio and motion detection with speech keyword boost'
      : 'Smart Moments audio loudness and motion detection with manual/.SRT keyword boost',
    enableAutoCaptions
      ? 'On-device Whisper Tiny auto captions, manual lines & .SRT import with 8 styles, deterministic Auto mix, and SRT/VTT export'
      : 'Manual & .SRT captions with 8 burn-in styles, Auto mix, inline editor, and SRT/VTT export',
    'Transparent PNG Watermark Maker, 3-second hook templates, animated GIF export, and PNG frame capture',
  ];
}

export function getSeoForRoute(pathname: string): HeadMetaData {
  const route = normalizeRoutePath(pathname);
  const ogImage = `${APP_CONFIG.SITE_URL}/og-image.png`;
  const appName = APP_CONFIG.appName;

  if (route === '/') {
    const title = `${appName} — Free Browser Video Clipper (No Uploads)`;
    const description =
      'Free browser video clipper: trim, reframe to 9:16, add captions and a logo for Shorts, TikTok, Instagram and Facebook Reels. Files stay on your device.';

    return {
      title: clampText(title, 60),
      description: clampText(description, 160),
      canonicalUrl: buildAbsoluteUrl('/'),
      robots: 'index, follow',
      ogType: 'website',
      ogImage,
      schemas: [
        {
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: appName,
          url: buildAbsoluteUrl('/'),
          description,
        },
        {
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: appName,
          url: buildAbsoluteUrl('/'),
          logo: `${APP_CONFIG.SITE_URL}/icon-512.png`,
          email: APP_CONFIG.contactEmail,
        },
        {
          '@context': 'https://schema.org',
          '@type': 'WebApplication',
          name: appName,
          url: buildAbsoluteUrl('/'),
          description: APP_CONFIG.entitySentence,
          applicationCategory: 'MultimediaApplication',
          operatingSystem: 'Any (Modern Web Browser)',
          browserRequirements: 'Requires JavaScript, WebAssembly, and HTML5 video playback',
          isAccessibleForFree: true,
          offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'USD',
          },
          featureList: getHomeFeatureList(),
        },
      ],
    };
  }

  if (route === '/editor') {
    return {
      title: clampText(`Video Clip Editor — Trim, 9:16 & Captions | ${appName}`, 60),
      description: clampText(
        `Cut MP4, MOV, and WebM clips in your browser. Use fast -c copy trimming, Smart Moments, 9:16 Smart follow, split facecam, captions, and .ZIP export.`,
        160
      ),
      canonicalUrl: buildAbsoluteUrl('/editor'),
      robots: 'index, follow',
      ogType: 'website',
      ogImage,
      schemas: [
        buildBreadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Editor', path: '/editor' },
        ]),
      ],
    };
  }

  if (route === '/templates') {
    return {
      title: clampText(`Video Clip Templates & Looks | ${appName}`, 60),
      description: clampText(
        `Explore 4 free browser video Looks: Blur Fill Classic, Action Follow, Gameplay + Facecam split, and Quick Cut stream-copy. No uploads.`,
        160
      ),
      canonicalUrl: buildAbsoluteUrl('/templates'),
      robots: 'index, follow',
      ogType: 'website',
      ogImage,
      schemas: [
        buildBreadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Templates', path: '/templates' },
        ]),
        {
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: `${appName} Video Clip Templates & Looks`,
          url: buildAbsoluteUrl('/templates'),
          description:
            'Pre-configured framing, zoom, split-screen, and caption styles that run locally in your browser editor.',
          isPartOf: {
            '@type': 'WebSite',
            name: appName,
            url: buildAbsoluteUrl('/'),
          },
        },
      ],
    };
  }

  if (route === '/watermark-maker') {
    return {
      title: clampText(`Free PNG Watermark Maker for Video Clips | ${appName}`, 60),
      description: clampText(
        `Design transparent PNG channel stamps with condensed or stencil fonts, outline, and drop shadow. Save PNG or send straight into the ${appName} editor.`,
        160
      ),
      canonicalUrl: buildAbsoluteUrl('/watermark-maker'),
      robots: 'index, follow',
      ogType: 'website',
      ogImage,
      schemas: [
        buildBreadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Watermark Maker', path: '/watermark-maker' },
        ]),
        {
          '@context': 'https://schema.org',
          '@type': 'HowTo',
          name: `How to Create a Transparent PNG Video Watermark in ${appName}`,
          description:
            'Design a crisp transparent PNG channel stamp on HTML5 canvas and send it straight to your video editor.',
          step: WATERMARK_MAKER_STEPS.map((step, idx) => ({
            '@type': 'HowToStep',
            position: idx + 1,
            name: step.name,
            text: step.text,
          })),
        },
      ],
    };
  }

  if (route === '/how-it-works') {
    return {
      title: clampText(`How ${appName} Works & Technical FAQ`, 60),
      description: clampText(
        APP_CONFIG.ENABLE_AUTO_CAPTIONS
          ? `How browser WebAssembly trimming, Smart Moments, Smart follow, Whisper Tiny captions, keyboard shortcuts, and 300 MB memory limits work in ${appName}.`
          : `How browser WebAssembly trimming, Smart Moments, Smart follow, styled SRT captions, keyboard shortcuts, and 300 MB memory limits work in ${appName}.`,
        160
      ),
      canonicalUrl: buildAbsoluteUrl('/how-it-works'),
      robots: 'index, follow',
      ogType: 'website',
      ogImage,
      schemas: [
        buildBreadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'How It Works', path: '/how-it-works' },
        ]),
        {
          '@context': 'https://schema.org',
          '@type': 'HowTo',
          name: `How to Trim and Reframe Videos in ${appName}`,
          description:
            'Five browser-only steps to trim highlights, reframe to 9:16 vertical, add captions, and export MP4 or .ZIP.',
          step: HOW_IT_WORKS_STEPS.map((step, idx) => ({
            '@type': 'HowToStep',
            position: idx + 1,
            name: step.name,
            text: step.text,
          })),
        },
        {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: HOW_IT_WORKS_FAQS.map((item) => ({
            '@type': 'Question',
            name: item.q,
            acceptedAnswer: {
              '@type': 'Answer',
              text: item.a,
            },
          })),
        },
      ],
    };
  }

  if (route === '/guides') {
    return {
      title: clampText(`Short-Form Video Clipping & Framing Guides | ${appName}`, 60),
      description: clampText(
        APP_CONFIG.ENABLE_AUTO_CAPTIONS
          ? `Guides for cutting 16:9 gameplay into 9:16 Shorts, TikTok, Instagram Reels, and Facebook Reels, split facecam layouts, and on-device captions.`
          : `Guides for cutting 16:9 gameplay into 9:16 Shorts, TikTok, Instagram Reels, and Facebook Reels, split facecam layouts, and styled SRT captions.`,
        160
      ),
      canonicalUrl: buildAbsoluteUrl('/guides'),
      robots: 'index, follow',
      ogType: 'website',
      ogImage,
      schemas: [
        buildBreadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Guides', path: '/guides' },
        ]),
        {
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: `${appName} Creator & Gamer Video Clipping Guides`,
          url: buildAbsoluteUrl('/guides'),
          hasPart: GUIDES.map((g) => ({
            '@type': 'Article',
            headline: g.h1,
            url: buildAbsoluteUrl(`/guides/${g.slug}`),
          })),
        },
      ],
    };
  }

  if (route.startsWith('/guides/')) {
    const slug = route.replace('/guides/', '');
    const guide = getGuideBySlug(slug);
    if (guide) {
      const schemas: Record<string, unknown>[] = [
        buildBreadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Guides', path: '/guides' },
          { name: guide.title, path: `/guides/${guide.slug}` },
        ]),
        {
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: guide.h1,
          description: guide.metaDescription,
          datePublished: guide.publishedAt,
          dateModified: guide.updatedAt,
          image: ogImage,
          author: {
            '@type': 'Organization',
            name: appName,
            url: buildAbsoluteUrl('/'),
          },
          publisher: {
            '@type': 'Organization',
            name: appName,
            url: buildAbsoluteUrl('/'),
            logo: {
              '@type': 'ImageObject',
              url: `${APP_CONFIG.SITE_URL}/icon-512.png`,
            },
          },
          mainEntityOfPage: buildAbsoluteUrl(`/guides/${guide.slug}`),
        },
      ];

      if (guide.faqs && guide.faqs.length > 0) {
        schemas.push({
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: guide.faqs.map((faq) => ({
            '@type': 'Question',
            name: faq.q,
            acceptedAnswer: {
              '@type': 'Answer',
              text: faq.a,
            },
          })),
        });
      }

      return {
        title: clampText(`${guide.title} | ${appName}`, 60),
        description: clampText(guide.metaDescription, 160),
        canonicalUrl: buildAbsoluteUrl(`/guides/${guide.slug}`),
        robots: 'index, follow',
        ogType: 'article',
        ogImage,
        schemas,
        publishedTime: guide.publishedAt,
        modifiedTime: guide.updatedAt,
      };
    }
  }

  if (route === '/about') {
    return {
      title: clampText(`About ${appName} — Private Browser Video Clipper`, 60),
      description: clampText(
        `Learn why ${appName} runs 100% locally in browser WebAssembly, what tools are included, its honest hardware limits, and how to contact the operator.`,
        160
      ),
      canonicalUrl: buildAbsoluteUrl('/about'),
      robots: 'index, follow',
      ogType: 'website',
      ogImage,
      schemas: [
        buildBreadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'About', path: '/about' },
        ]),
      ],
    };
  }

  if (route === '/privacy') {
    return {
      title: clampText(`Privacy Policy | ${appName}`, 60),
      description: clampText(
        `${appName} keeps video files strictly inside local browser memory with zero server uploads. Read about local storage and optional ad controls.`,
        160
      ),
      canonicalUrl: buildAbsoluteUrl('/privacy'),
      robots: 'index, follow',
      ogType: 'website',
      ogImage,
      schemas: [
        buildBreadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Privacy Policy', path: '/privacy' },
        ]),
      ],
    };
  }

  if (route === '/terms') {
    return {
      title: clampText(`Terms of Use | ${appName}`, 60),
      description: clampText(
        `Terms of use for ${appName}, a free browser-side WebAssembly video trimming, vertical reframing, captioning, and PNG watermarking tool.`,
        160
      ),
      canonicalUrl: buildAbsoluteUrl('/terms'),
      robots: 'index, follow',
      ogType: 'website',
      ogImage,
      schemas: [
        buildBreadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Terms of Use', path: '/terms' },
        ]),
      ],
    };
  }

  if (route === '/contact') {
    return {
      title: clampText(`Contact | ${appName}`, 60),
      description: clampText(
        `Report browser codec issues, suggest presets, or reach the ${appName} operator directly via prepared email draft.`,
        160
      ),
      canonicalUrl: buildAbsoluteUrl('/contact'),
      robots: 'index, follow',
      ogType: 'website',
      ogImage,
      schemas: [
        buildBreadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Contact', path: '/contact' },
        ]),
      ],
    };
  }

  return {
    title: clampText(`Page Not Found | ${appName}`, 60),
    description: clampText(`The requested page does not exist on ${appName}.`, 160),
    canonicalUrl: buildAbsoluteUrl(route),
    robots: 'noindex, nofollow',
    ogType: 'website',
    ogImage,
    schemas: [],
  };
}

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function renderHeadTagsHtml(
  meta: HeadMetaData,
  verification: { google?: string; bing?: string } = APP_CONFIG.siteVerification
): string {
  const tags: string[] = [
    `<title>${escapeHtmlAttr(meta.title)}</title>`,
    `<meta name="description" content="${escapeHtmlAttr(meta.description)}" data-cliplab-seo="true" />`,
    `<meta name="robots" content="${escapeHtmlAttr(meta.robots)}" data-cliplab-seo="true" />`,
    `<link rel="canonical" href="${escapeHtmlAttr(meta.canonicalUrl)}" data-cliplab-seo="true" />`,
    `<meta property="og:title" content="${escapeHtmlAttr(meta.title)}" data-cliplab-seo="true" />`,
    `<meta property="og:description" content="${escapeHtmlAttr(meta.description)}" data-cliplab-seo="true" />`,
    `<meta property="og:type" content="${escapeHtmlAttr(meta.ogType)}" data-cliplab-seo="true" />`,
    `<meta property="og:url" content="${escapeHtmlAttr(meta.canonicalUrl)}" data-cliplab-seo="true" />`,
    `<meta property="og:site_name" content="${escapeHtmlAttr(APP_CONFIG.appName)}" data-cliplab-seo="true" />`,
    `<meta property="og:image" content="${escapeHtmlAttr(meta.ogImage)}" data-cliplab-seo="true" />`,
    `<meta property="og:image:width" content="1200" data-cliplab-seo="true" />`,
    `<meta property="og:image:height" content="630" data-cliplab-seo="true" />`,
    `<meta name="twitter:card" content="summary_large_image" data-cliplab-seo="true" />`,
    `<meta name="twitter:title" content="${escapeHtmlAttr(meta.title)}" data-cliplab-seo="true" />`,
    `<meta name="twitter:description" content="${escapeHtmlAttr(meta.description)}" data-cliplab-seo="true" />`,
    `<meta name="twitter:image" content="${escapeHtmlAttr(meta.ogImage)}" data-cliplab-seo="true" />`,
  ];

  if (meta.publishedTime) {
    tags.push(
      `<meta property="article:published_time" content="${escapeHtmlAttr(meta.publishedTime)}" data-cliplab-seo="true" />`
    );
  }
  if (meta.modifiedTime) {
    tags.push(
      `<meta property="article:modified_time" content="${escapeHtmlAttr(meta.modifiedTime)}" data-cliplab-seo="true" />`
    );
  }

  const googleToken = resolveVerificationToken(verification.google);
  const bingToken = resolveVerificationToken(verification.bing);

  if (googleToken) {
    tags.push(
      `<meta name="google-site-verification" content="${escapeHtmlAttr(googleToken)}" data-cliplab-seo="true" />`
    );
  }
  if (bingToken) {
    tags.push(
      `<meta name="msvalidate.01" content="${escapeHtmlAttr(bingToken)}" data-cliplab-seo="true" />`
    );
  }

  for (const schema of meta.schemas) {
    const json = JSON.stringify(schema).replace(/<\//g, '<\\/');
    tags.push(`<script type="application/ld+json" data-cliplab-seo="true">${json}</script>`);
  }

  return tags.join('\n    ');
}
