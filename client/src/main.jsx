import { StrictMode, Suspense, lazy, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider, Outlet, useMatches, useRouteError } from 'react-router-dom';
import { AuthProvider, RequireAuth } from '@/lib/auth';
import { applyTheme, initialTheme } from '@/lib/theme';
import { Layout } from '@/components/app/layout';
import { Toaster, DialogHost } from '@/components/app/kit';
import { GlowCursor, ClickSounds } from '@/components/app/fx-global';
import { DoorTransition } from '@/components/app/signin-extras';
import { PageLoader, LogoMark } from '@/components/app/brand';
import { useMotionKit } from '@/lib/motion-kit';
import { Button } from '@/components/ui/button';
import './index.css';

// Each page is loaded when it is first opened, so the first screen arrives faster.
const Landing = lazy(() => import('./pages/Landing'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Login = lazy(() => import('./pages/Login'));
const Reauth = lazy(() => import('./pages/Reauth'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Documents = lazy(() => import('./pages/Documents'));
const Access = lazy(() => import('./pages/Access'));
const Shares = lazy(() => import('./pages/Shares'));
const Activity = lazy(() => import('./pages/Activity'));
const Security = lazy(() => import('./pages/Security'));
const StudentList = lazy(() => import('./pages/Records').then((m) => ({ default: m.StudentList })));
const StudentRecord = lazy(() => import('./pages/Records').then((m) => ({ default: m.StudentRecord })));
const Admin = lazy(() => import('./pages/Admin'));
const SharedView = lazy(() => import('./pages/SharedView'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Tutorial = lazy(() => import('./pages/Tutorial'));
const Mailbox = lazy(() => import('./pages/Mailbox'));

applyTheme(initialTheme()); // before first paint: no flash of the wrong theme

const staff = ['verifier'];
const only = (roles, page) => <RequireAuth roles={roles}>{page}</RequireAuth>;

// Every route names itself in `handle.title`; the browser tab shows "Page · TrustVault".
function PageTitle() {
  const title = useMatches().findLast((m) => m.handle?.title)?.handle.title;
  useEffect(() => { document.title = title ? `${title} · TrustVault` : 'TrustVault - digital identity and document verification portal'; }, [title]);
  return null;
}

function Root() {
  useMotionKit();
  return (
    <AuthProvider>
      <PageTitle />
      <Suspense fallback={<PageLoader />}><Outlet /></Suspense>
      <Toaster />
      <DialogHost />
      <ClickSounds />
      <DoorTransition />
      <GlowCursor />
    </AuthProvider>
  );
}

// Shown instead of a blank screen when a page crashes or cannot be loaded (for example right after an update).
function Crashed() {
  const error = useRouteError();
  useEffect(() => { console.error(error); }, [error]);
  return (
    <main className="grid min-h-dvh place-items-center bg-background p-6 text-center text-foreground">
      <div className="grid max-w-sm justify-items-center gap-4">
        <LogoMark size={48} />
        <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">This page could not be shown. Your documents are safe. Reloading usually fixes it.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={() => location.reload()}>Reload the page</Button>
          <Button variant="outline" onClick={() => location.assign('/')}>Go home</Button>
        </div>
      </div>
    </main>
  );
}

const router = createBrowserRouter([{
  element: <Root />,
  errorElement: <Crashed />,
  children: [
    { path: '/welcome', element: <Landing /> }, // no short title: search results show the full name
    { path: '/privacy', element: <Privacy />, handle: { title: 'Privacy policy' } },
    { path: '/tutorial', element: <Tutorial />, handle: { title: 'Tutorial' } },
    { path: '/mailbox', element: <Mailbox />, handle: { title: 'Demo mailbox' } },
    { path: '/login', element: <Login mode="login" />, handle: { title: 'Sign in' } },
    { path: '/register', element: <Login mode="register" />, handle: { title: 'Create account' } },
    { path: '/reauth', element: <Reauth />, handle: { title: 'Confirm it is you' } },
    { path: '/share/:token', element: <SharedView />, handle: { title: 'Shared document' } },
    {
      element: <RequireAuth><Layout /></RequireAuth>,
      children: [
        { index: true, element: <Dashboard />, handle: { title: 'Home' } },
        { path: 'documents', element: <Documents />, handle: { title: 'My documents' } },
        { path: 'access', element: only(['student'], <Access />), handle: { title: 'Access requests' } },
        { path: 'shares', element: <Shares />, handle: { title: 'Shared links' } },
        { path: 'activity', element: <Activity />, handle: { title: 'Activity log' } },
        { path: 'security', element: <Security />, handle: { title: 'Security' } },
        { path: 'records', element: only(staff, <StudentList />), handle: { title: 'Student records' } },
        { path: 'records/:id', element: only(staff, <StudentRecord />), handle: { title: 'Student record' } },
        { path: 'admin', element: only(['admin'], <Admin />), handle: { title: 'Admin' } },
      ],
    },
    { path: '*', element: <NotFound />, handle: { title: 'Page not found' } },
  ],
}]);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
