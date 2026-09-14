import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { ThemeToggle } from './ThemeToggle';
import { clearStoredToken } from '../services/api';
import './MainNav.css';

interface MainNavProps {
  onLogout: () => void;
}

export const MainNav = ({ onLogout }: MainNavProps) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    clearStoredToken();
    onLogout();
  };

  return (
    <nav className="main-nav">
      <button
        type="button"
        className="nav-menu-btn"
        aria-label="Menüyü aç"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
      >
        Menü
      </button>
      <div className={`main-nav-tabs ${menuOpen ? 'open' : ''}`}>
        <NavLink
          to="/"
          end
          className={({ isActive }) => `nav-tab ${isActive ? 'nav-tab-active' : ''}`}
          onClick={() => setMenuOpen(false)}
        >
          Bugün
        </NavLink>
        <NavLink
          to="/danisanlar"
          className={({ isActive }) => `nav-tab ${isActive ? 'nav-tab-active' : ''}`}
          onClick={() => setMenuOpen(false)}
        >
          Danışanlar
        </NavLink>
        <NavLink
          to="/takvim"
          className={({ isActive }) => `nav-tab ${isActive ? 'nav-tab-active' : ''}`}
          onClick={() => setMenuOpen(false)}
        >
          Takvim
        </NavLink>
        <NavLink
          to="/odemeler"
          className={({ isActive }) => `nav-tab ${isActive ? 'nav-tab-active' : ''}`}
          onClick={() => setMenuOpen(false)}
        >
          Ödemeler
        </NavLink>
        <NavLink
          to="/raporlar"
          className={({ isActive }) => `nav-tab ${isActive ? 'nav-tab-active' : ''}`}
          onClick={() => setMenuOpen(false)}
        >
          Raporlar
        </NavLink>
        <NavLink
          to="/klinik"
          className={({ isActive }) => `nav-tab ${isActive ? 'nav-tab-active' : ''}`}
          onClick={() => setMenuOpen(false)}
        >
          Klinik
        </NavLink>
        <NavLink
          to="/hesap"
          className={({ isActive }) => `nav-tab ${isActive ? 'nav-tab-active' : ''}`}
          onClick={() => setMenuOpen(false)}
        >
          Hesap
        </NavLink>
      </div>
      <div className="main-nav-actions">
        <ThemeToggle />
        <button type="button" className="nav-logout-btn" onClick={handleLogout}>
          Çıkış
        </button>
      </div>
    </nav>
  );
};
