import React, { createContext, useContext, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { APP_CONFIG, resolveVerificationToken } from '../config/appConfig';
import { getSeoForRoute, type HeadMetaData } from '../utils/seo';

export interface HeadCollector {
  meta?: HeadMetaData;
}

const HeadContext = createContext<HeadCollector | null>(null);

export function HeadProvider({
  collector,
  children,
}: {
  collector?: HeadCollector;
  children: React.ReactNode;
}) {
  return <HeadContext.Provider value={collector ?? null}>{children}</HeadContext.Provider>;
}

function upsertManagedMeta(
  attr: 'name' | 'property',
  key: string,
  content: string | undefined
) {
  const selector = `meta[${attr}="${key}"]`;
  const existing = document.head.querySelector(selector);
  if (!content) {
    if (existing?.getAttribute('data-cliplab-seo') === 'true') {
      existing.remove();
    }
    return;
  }
  const el = existing ?? document.createElement('meta');
  el.setAttribute(attr, key);
  el.setAttribute('content', content);
  el.setAttribute('data-cliplab-seo', 'true');
  if (!existing) {
    document.head.appendChild(el);
  }
}

function upsertCanonical(url: string) {
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', url);
  el.setAttribute('data-cliplab-seo', 'true');
}

/**
 * Syncs per-route <title>, meta description, canonical link, OG/Twitter tags,
 * verification tags, and JSON-LD scripts in both SSR collector and browser DOM.
 */
export function RouteSeoManager() {
  const { pathname } = useLocation();
  const collector = useContext(HeadContext);
  const meta = getSeoForRoute(pathname);

  if (collector) {
    collector.meta = meta;
  }

  useEffect(() => {
    document.title = meta.title;
    upsertCanonical(meta.canonicalUrl);

    upsertManagedMeta('name', 'description', meta.description);
    upsertManagedMeta('name', 'robots', meta.robots);
    upsertManagedMeta('property', 'og:title', meta.title);
    upsertManagedMeta('property', 'og:description', meta.description);
    upsertManagedMeta('property', 'og:type', meta.ogType);
    upsertManagedMeta('property', 'og:url', meta.canonicalUrl);
    upsertManagedMeta('property', 'og:site_name', APP_CONFIG.appName);
    upsertManagedMeta('property', 'og:image', meta.ogImage);
    upsertManagedMeta('name', 'twitter:card', 'summary_large_image');
    upsertManagedMeta('name', 'twitter:title', meta.title);
    upsertManagedMeta('name', 'twitter:description', meta.description);
    upsertManagedMeta('name', 'twitter:image', meta.ogImage);
    upsertManagedMeta('property', 'article:published_time', meta.publishedTime);
    upsertManagedMeta('property', 'article:modified_time', meta.modifiedTime);
    upsertManagedMeta(
      'name',
      'google-site-verification',
      resolveVerificationToken(APP_CONFIG.siteVerification.google) || undefined
    );
    upsertManagedMeta(
      'name',
      'msvalidate.01',
      resolveVerificationToken(APP_CONFIG.siteVerification.bing) || undefined
    );

    // Replace managed JSON-LD scripts cleanly per route
    document.head
      .querySelectorAll('script[type="application/ld+json"][data-cliplab-seo="true"]')
      .forEach((node) => node.remove());

    for (const schema of meta.schemas) {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute('data-cliplab-seo', 'true');
      script.textContent = JSON.stringify(schema);
      document.head.appendChild(script);
    }
  }, [meta]);

  return null;
}
