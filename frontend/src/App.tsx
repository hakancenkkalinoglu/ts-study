import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { MainNav } from './components/MainNav';
import { ClientsList } from './pages/ClientsList';
import { ClientDetail } from './pages/ClientDetail';
import { Calendar } from './pages/Calendar';
import { Payments } from './pages/Payments';
import { Reports } from './pages/Reports';
import './App.css';

function App() {
  return (
    <ThemeProvider>
      <Router>
        <div className="app">
          <MainNav />
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
