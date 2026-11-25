import { useRoutes } from 'react-router-dom';
import { ClipLabProvider } from './context/ClipLabContext';
import { HeadProvider, RouteSeoManager, type HeadCollector } from './context/HeadContext';
import { Layout } from './components/Layout';
import { ROUTES } from './routes';

function AppRoutes() {
  return useRoutes(ROUTES);
}

export function AppShell({ headCollector }: { headCollector?: HeadCollector }) {
  return (
    <HeadProvider collector={headCollector}>
      <ClipLabProvider>
        <RouteSeoManager />
        <Layout>
          <AppRoutes />
        </Layout>
      </ClipLabProvider>
    </HeadProvider>
  );
}

export default AppShell;
