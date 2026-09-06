import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { MainNav } from './components/MainNav';
import { Login } from './pages/Login';
import { Today } from './pages/Today';
import { ClientsList } from './pages/ClientsList';
import { ClientDetail } from './pages/ClientDetail';
import { Calendar } from './pages/Calendar';
import { Payments } from './pages/Payments';
import { Reports } from './pages/Reports';
import { ClinicPage } from './pages/Clinic';
import { getStoredToken, setStoredToken } from './services/api';
import './App.css';

function consumeGoogleTokenFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  if (!token) {
    return getStoredToken();
  }
  setStoredToken(token);
  params.delete('token');
  params.delete('google');
  const query = params.toString();
  const next = window.location.pathname + (query ? `?${query}` : '') + window.location.hash;
  window.history.replaceState({}, '', next);
  return token;
}

function App() {
  const [token, setToken] = useState<string | null>(() => consumeGoogleTokenFromUrl());

  if (!token) {
    return (
      <ThemeProvider>
        <Login onSuccess={() => setToken(getStoredToken())} />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
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
            <Route path="/client/:id" element={<ClientDetail />} />
          </Routes>
        </div>
      </Router>
    </ThemeProvider>
  );
}

export default App;
