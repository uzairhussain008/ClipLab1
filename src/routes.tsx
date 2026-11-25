import type { RouteObject } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { EditorPage } from './pages/EditorPage';
import { WatermarkMakerPage } from './pages/WatermarkMakerPage';
import { HowItWorksPage } from './pages/HowItWorksPage';
import { GuidesIndexPage } from './pages/GuidesIndexPage';
import { GuideDetailPage } from './pages/GuideDetailPage';
import { TemplatesPage } from './pages/TemplatesPage';
import { AboutPage } from './pages/AboutPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { TermsPage } from './pages/TermsPage';
import { ContactPage } from './pages/ContactPage';
import { NotFoundPage } from './pages/NotFoundPage';

/**
 * Single centralized route list compatible with React Router and static pre-rendering.
 */
export const ROUTES: RouteObject[] = [
  { path: '/', element: <HomePage /> },
  { path: '/editor', element: <EditorPage /> },
  { path: '/templates', element: <TemplatesPage /> },
  { path: '/watermark-maker', element: <WatermarkMakerPage /> },
  { path: '/guides', element: <GuidesIndexPage /> },
  { path: '/guides/:slug', element: <GuideDetailPage /> },
  { path: '/how-it-works', element: <HowItWorksPage /> },
  { path: '/about', element: <AboutPage /> },
  { path: '/privacy', element: <PrivacyPage /> },
  { path: '/terms', element: <TermsPage /> },
  { path: '/contact', element: <ContactPage /> },
  { path: '*', element: <NotFoundPage /> },
];

