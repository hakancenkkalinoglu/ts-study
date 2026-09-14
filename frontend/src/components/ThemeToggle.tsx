import { useTheme } from '../contexts/ThemeContext';
import './ThemeToggle.css';

export const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      title="Tema Değiştir"
      aria-label={theme === 'light' ? 'Koyu temaya geç' : 'Açık temaya geç'}
      aria-pressed={theme === 'dark'}
    >
      {theme === 'light' ? '🌙' : '☀️'}
    </button>
  );
};
