import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import { MainNav } from './components/MainNav';
import { Login } from './pages/Login';
import { Today } from './pages/Today';
import { ClientsList } from './pages/ClientsList';
import { ClientDetail } from './pages/ClientDetail';
import { Calendar } from './pages/Calendar';
import { Payments } from './pages/Payments';
import { Reports } from './pages/Reports';
import { ClinicPage } from './pages/Clinic';
import { Account } from './pages/Account';
import { NotFound } from './pages/NotFound';
import { exchangeGoogleAuth, getStoredToken, setStoredToken } from './services/api';
import './App.css';

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

function App() {
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
        if (cancelled) return;
        setStoredToken(result.token);
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

  if (bootstrapping) {
    return (
      <ThemeProvider>
        <ToastProvider>
          <Login onSuccess={() => setToken(getStoredToken())} bootstrapping />
        </ToastProvider>
      </ThemeProvider>
    );
  }

  if (!token) {
    return (
      <ThemeProvider>
        <ToastProvider>
          <Login onSuccess={() => setToken(getStoredToken())} />
        </ToastProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <ToastProvider>
        <Router>
          <div className="app">
            <MainNav onLogout={() => setToken(null)} />
            <Routes>
              <Route path="/" element={<Today />} />
              <Route path="/danisanlar" element={<ClientsList />} />
              <Route path="/takvim" element={<Calendar />} />
              <Route path="/odemeler" element={<Payments />} />
              <Route path="/raporlar" element={<Reports />} />
              <Route path="/klinik" element={<ClinicPage />} />
              <Route path="/hesap" element={<Account />} />
              <Route path="/client/:id" element={<ClientDetail />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </Router>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
