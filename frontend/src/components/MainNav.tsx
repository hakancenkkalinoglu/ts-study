import { NavLink } from 'react-router-dom';
import { ThemeToggle } from './ThemeToggle';
import './MainNav.css';

export const MainNav = () => {
  return (
    <nav className="main-nav">
      <div className="main-nav-tabs">
        <NavLink
          to="/"
          end
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
      </div>
    </nav>
  );
};
