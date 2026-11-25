import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import { AppShell } from './App';
import { APP_CONFIG } from './config/appConfig';
import type { HeadCollector } from './context/HeadContext';
import { HOW_IT_WORKS_FAQS } from './data/faqs';
import { GUIDES } from './data/guides';
import { getAllIndexableRoutes, getSeoForRoute, renderHeadTagsHtml } from './utils/seo';

export function renderRoute(url: string): { appHtml: string; headHtml: string } {
  const collector: HeadCollector = {};
  const appHtml = renderToString(
    <StaticRouter location={url}>
      <AppShell headCollector={collector} />
    </StaticRouter>
  );

  const meta = collector.meta ?? getSeoForRoute(url);
  const headHtml = renderHeadTagsHtml(meta);
  return { appHtml, headHtml };
}

export const getIndexableRoutes = getAllIndexableRoutes;

export const siteConfig = {
  appName: APP_CONFIG.appName,
  SITE_URL: APP_CONFIG.SITE_URL,
  entitySentence: APP_CONFIG.entitySentence,
  platformDisclaimer: APP_CONFIG.platformDisclaimer,
  allowAiCrawlers: APP_CONFIG.allowAiCrawlers,
  enableAutoCaptions: APP_CONFIG.ENABLE_AUTO_CAPTIONS,
  faqCount: HOW_IT_WORKS_FAQS.length,
  indexNowKey: APP_CONFIG.siteVerification.indexNowKey,
};

export const guidesList = GUIDES.map((g) => ({
  slug: g.slug,
  h1: g.h1,
  metaDescription: g.metaDescription,
}));
