import { useTheme } from '../contexts/ThemeContext';
import './ThemeToggle.css';

export const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button className="theme-toggle" onClick={toggleTheme} title="Tema Değiştir">
      {theme === 'light' ? '🌙' : '☀️'}
    </button>
  );
};
