import { useState, FormEvent, useEffect } from 'react';
import { login, register, setStoredToken, getGoogleLoginUrl } from '../services/api';
import './Login.css';

interface LoginProps {
  onSuccess: () => void;
}

export const Login = ({ onSuccess }: LoginProps) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordRepeat, setPasswordRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const google = params.get('google');
    if (google === 'error' || google === 'missing_code') {
      setError('Google ile giriş tamamlanamadı. Tekrar deneyin.');
    }
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (mode === 'register' && password !== passwordRepeat) {
      setError('Şifreler eşleşmiyor.');
      return;
    }
    setLoading(true);
    try {
      const action = mode === 'register' ? register : login;
      const { token } = await action(email.trim(), password);
      setStoredToken(token);
      onSuccess();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      setError(msg || (mode === 'register' ? 'Kayıt yapılamadı.' : 'Giriş yapılamadı.'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      const url = await getGoogleLoginUrl();
      window.location.href = url;
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      setError(msg || 'Google girişi ayarlı değil. GOOGLE_CLIENT_ID tanımlı mı?');
      setGoogleLoading(false);
    }
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setError(null);
    setPasswordRepeat('');
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">TestPsikolog</h1>
        <p className="login-subtitle">
          Gmail ile giriş yapınca takvim ve Meet de bağlanır. Forma e-posta yazmak Google izni vermez.
        </p>
        <button
          type="button"
          className="login-google-btn"
          onClick={handleGoogle}
          disabled={loading || googleLoading}
        >
          {googleLoading ? 'Google açılıyor...' : 'Google ile devam et'}
        </button>
        <div className="login-divider">
          <span>veya e-posta ile</span>
        </div>
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="email">E-posta</label>
            <input
              id="email"
              type={mode === 'register' ? 'email' : 'text'}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Şifre</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              required
              minLength={mode === 'register' ? 6 : undefined}
            />
          </div>
          {mode === 'register' && (
            <div className="form-group">
              <label htmlFor="passwordRepeat">Şifre tekrar</label>
              <input
                id="passwordRepeat"
                type="password"
                value={passwordRepeat}
                onChange={(e) => setPasswordRepeat(e.target.value)}
                autoComplete="new-password"
                required
                minLength={6}
              />
            </div>
          )}
          {error && <div className="login-error">{error}</div>}
          <button type="submit" className="login-btn" disabled={loading || googleLoading}>
            {loading
              ? mode === 'register'
                ? 'Kayıt yapılıyor...'
                : 'Giriş yapılıyor...'
              : mode === 'register'
                ? 'Kayıt ol'
                : 'Giriş yap'}
          </button>
        </form>
        <button type="button" className="login-switch" onClick={switchMode}>
          {mode === 'login' ? 'Hesabın yok mu? Kayıt ol' : 'Zaten hesabın var mı? Giriş yap'}
        </button>
      </div>
    </div>
  );
};
