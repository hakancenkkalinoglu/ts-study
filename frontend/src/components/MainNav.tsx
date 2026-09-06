import { NavLink } from 'react-router-dom';
import { ThemeToggle } from './ThemeToggle';
import { clearStoredToken } from '../services/api';
import './MainNav.css';

interface MainNavProps {
  onLogout: () => void;
}

export const MainNav = ({ onLogout }: MainNavProps) => {
  const handleLogout = () => {
    clearStoredToken();
    onLogout();
  };

  return (
    <nav className="main-nav">
      <div className="main-nav-tabs">
        <NavLink
          to="/"
          end
          className={({ isActive }) => `nav-tab ${isActive ? 'nav-tab-active' : ''}`}
        >
          Bugün
        </NavLink>
        <NavLink
          to="/danisanlar"
          className={({ isActive }) => `nav-tab ${isActive ? 'nav-tab-active' : ''}`}
        >
          Danışanlar
        </NavLink>
        <NavLink
          to="/takvim"
          className={({ isActive }) => `nav-tab ${isActive ? 'nav-tab-active' : ''}`}
        >
          Takvim
        </NavLink>
        <NavLink
          to="/odemeler"
          className={({ isActive }) => `nav-tab ${isActive ? 'nav-tab-active' : ''}`}
        >
          Ödemeler
        </NavLink>
        <NavLink
          to="/raporlar"
          className={({ isActive }) => `nav-tab ${isActive ? 'nav-tab-active' : ''}`}
        >
          Raporlar
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
