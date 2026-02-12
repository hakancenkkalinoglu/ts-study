import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { MainNav } from './components/MainNav';
import { Login } from './pages/Login';
import { ClientsList } from './pages/ClientsList';
import { ClientDetail } from './pages/ClientDetail';
import { Calendar } from './pages/Calendar';
import { Payments } from './pages/Payments';
import { Reports } from './pages/Reports';
import { getStoredToken } from './services/api';
import './App.css';

function App() {
  const [token, setToken] = useState<string | null>(() => getStoredToken());

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
            <Route path="/" element={<ClientsList />} />
            <Route path="/takvim" element={<Calendar />} />
            <Route path="/odemeler" element={<Payments />} />
            <Route path="/raporlar" element={<Reports />} />
            <Route path="/client/:id" element={<ClientDetail />} />
          </Routes>
        </div>
      </Router>
    </ThemeProvider>
  );
}

export default App;
