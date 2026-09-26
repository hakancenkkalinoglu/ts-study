import { useEffect, useState, type ReactNode } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import { ConfirmProvider } from './contexts/ConfirmDialog';
import { ClinicProvider } from './contexts/ClinicContext';
import { AppShell } from './components/AppShell';
import { Login } from './pages/Login';
import { Today } from './pages/Today';
import { ClientsList } from './pages/ClientsList';
import { ClientDetail } from './pages/ClientDetail';
import { Calendar } from './pages/Calendar';
import { Payments } from './pages/Payments';
import { Reports } from './pages/Reports';
import { ClinicPage } from './pages/Clinic';
import { ClinicOverviewPage } from './pages/ClinicOverview';
import { Account } from './pages/Account';
import { InviteAccept } from './pages/InviteAccept';
import { NotFound } from './pages/NotFound';
import { exchangeGoogleAuth, getStoredToken, setStoredToken } from './services/api';

const readAuthCodeFromUrl = (): string | null => {
  const params = new URLSearchParams(window.location.search);
  return params.get('auth');
};

const stripAuthQuery = (failed = false): void => {
  const params = new URLSearchParams(window.location.search);
  params.delete('token');
  params.delete('auth');
  if (failed) {
    params.set('google', 'error');
  } else {
    params.delete('google');
  }
  const query = params.toString();
  const next = window.location.pathname + (query ? `?${query}` : '') + window.location.hash;
  window.history.replaceState({}, '', next);
};

const AppProviders = ({ children }: { children: ReactNode }) => (
  <ThemeProvider>
    <ToastProvider>
      <ConfirmProvider>{children}</ConfirmProvider>
    </ToastProvider>
  </ThemeProvider>
);

const readInviteToken = (): string | null => {
  const match = window.location.pathname.match(/^\/invite\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : null;
};

function App() {
  const [inviteToken, setInviteToken] = useState(() => readInviteToken());
  const [authCode] = useState(() => readAuthCodeFromUrl());
  const [token, setToken] = useState<string | null>(() => (authCode ? null : getStoredToken()));
  const [bootstrapping, setBootstrapping] = useState(() => Boolean(authCode));

  useEffect(() => {
    const leakedToken = new URLSearchParams(window.location.search).has('token');
    if (!authCode) {
      if (leakedToken) {
        stripAuthQuery();
      }
      return;
    }
    let cancelled = false;
    exchangeGoogleAuth(authCode)
      .then((result) => {
        setStoredToken(result.token);
        if (cancelled) return;
        stripAuthQuery();
        setToken(result.token);
      })
      .catch(() => {
        if (cancelled) return;
        stripAuthQuery(true);
        setToken(getStoredToken());
      })
      .finally(() => {
        if (!cancelled) setBootstrapping(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authCode]);

  if (inviteToken) {
    return (
      <AppProviders>
        <InviteAccept
          token={inviteToken}
          onAccepted={() => {
            window.history.replaceState({}, '', '/klinik');
            setInviteToken(null);
            setToken(getStoredToken());
          }}
        />
      </AppProviders>
    );
  }

  if (bootstrapping) {
    return (
      <AppProviders>
        <Login onSuccess={() => setToken(getStoredToken())} bootstrapping />
      </AppProviders>
    );
  }

  if (!token) {
    return (
      <AppProviders>
        <Login onSuccess={() => setToken(getStoredToken())} />
      </AppProviders>
    );
  }

  return (
    <AppProviders>
      <ClinicProvider>
        <Router>
          <AppShell onLogout={() => setToken(null)}>
            <Routes>
              <Route path="/" element={<Today />} />
              <Route path="/danisanlar" element={<ClientsList />} />
              <Route path="/takvim" element={<Calendar />} />
              <Route path="/odemeler" element={<Payments />} />
              <Route path="/raporlar" element={<Reports />} />
              <Route path="/klinik" element={<ClinicPage />} />
              <Route path="/klinik-raporu" element={<ClinicOverviewPage />} />
              <Route path="/hesap" element={<Account />} />
              <Route path="/client/:id" element={<ClientDetail />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AppShell>
        </Router>
      </ClinicProvider>
    </AppProviders>
  );
}

export default App;
