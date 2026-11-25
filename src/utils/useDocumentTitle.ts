import { useEffect } from 'react';
import { APP_CONFIG } from '../config/appConfig';

export function useDocumentTitle(pageTitle?: string) {
  useEffect(() => {
    document.title = pageTitle ? `${pageTitle} — ${APP_CONFIG.appName}` : `${APP_CONFIG.appName} — Free In-Browser Video Clipper`;
  }, [pageTitle]);
}
