import { useState, FormEvent, useEffect } from 'react';
import {
  login,
  register,
  setStoredToken,
  getGoogleLoginUrl,
  forgotPassword,
  resetPassword,
  apiErrorMessage,
} from '../services/api';
import './Login.css';

interface LoginProps {
  onSuccess: () => void;
  bootstrapping?: boolean;
}

export const Login = ({ onSuccess, bootstrapping = false }: LoginProps) => {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [passwordRepeat, setPasswordRepeat] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [kvkkAccepted, setKvkkAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const google = params.get('google');
    if (google === 'error' || google === 'missing_code') {
      setError('Google ile giriş tamamlanamadı. Tekrar deneyin.');
    }
    if (sessionStorage.getItem('session_expired') === '1') {
      sessionStorage.removeItem('session_expired');
      setError('Oturumunuz sona erdi. Tekrar giriş yapın.');
    }
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (mode === 'register' && password !== passwordRepeat) {
      setError('Şifreler eşleşmiyor.');
      return;
    }
    if (mode === 'register' && !kvkkAccepted) {
      setError('Kayıt için KVKK aydınlatma metnini onaylayın.');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'forgot') {
        const message = await forgotPassword(email.trim());
        setInfo(message);
        setMode('reset');
        return;
      }
      if (mode === 'reset') {
        const message = await resetPassword(email.trim(), resetCode.trim(), password);
        setInfo(message);
        setMode('login');
        setPassword('');
        return;
      }
      const action =
        mode === 'register'
          ? () => register(email.trim(), password, displayName.trim() || undefined)
          : () => login(email.trim(), password);
      const { token } = await action();
      setStoredToken(token);
      onSuccess();
    } catch (err: unknown) {
      setError(apiErrorMessage(err, mode === 'register' ? 'Kayıt yapılamadı.' : 'İşlem tamamlanamadı.'));
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
      setError(apiErrorMessage(err, 'Google girişi şu anda kullanılamıyor. E-posta ile deneyin.'));
      setGoogleLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">TestPsikolog</h1>
        {bootstrapping ? (
          <p className="login-subtitle">Google girişi tamamlanıyor...</p>
        ) : (
          <p className="login-subtitle">
            Psikolog hesabıyla danışan, randevu ve seans notlarınızı yönetin. Google ile giriş takvimi de bağlar.
          </p>
        )}
        {bootstrapping ? null : (
          <>
            {mode === 'login' || mode === 'register' ? (
              <>
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
              </>
            ) : null}
            <form onSubmit={handleSubmit} className="login-form">
              {mode === 'register' ? (
                <div className="form-group">
                  <label htmlFor="displayName">Görünen ad</label>
                  <input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    autoComplete="name"
                  />
                </div>
              ) : null}
              <div className="form-group">
                <label htmlFor="email">E-posta</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
              {mode === 'reset' ? (
                <div className="form-group">
                  <label htmlFor="resetCode">Sıfırlama kodu</label>
                  <input
                    id="resetCode"
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                    required
                  />
                </div>
              ) : null}
              {mode !== 'forgot' ? (
                <div className="form-group">
                  <label htmlFor="password">{mode === 'reset' ? 'Yeni şifre' : 'Şifre'}</label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    required
                    minLength={mode === 'login' ? undefined : 6}
                  />
                </div>
              ) : null}
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
              {mode === 'register' ? (
                <label className="login-kvkk">
                  <input
                    type="checkbox"
                    checked={kvkkAccepted}
                    onChange={(e) => setKvkkAccepted(e.target.checked)}
                  />
                  Klinik notların gizliliğini koruyacağımı ve KVKK aydınlatmasını okuduğumu onaylıyorum.
                </label>
              ) : null}
              {error && <div className="login-error">{error}</div>}
              {info && <div className="login-info">{info}</div>}
              <button type="submit" className="login-btn" disabled={loading || googleLoading}>
                {loading
                  ? 'İşleniyor...'
                  : mode === 'register'
                    ? 'Kayıt ol'
                    : mode === 'forgot'
                      ? 'Kod oluştur'
                      : mode === 'reset'
                        ? 'Şifreyi sıfırla'
                        : 'Giriş yap'}
              </button>
            </form>
            {mode === 'login' ? (
              <button type="button" className="login-switch" onClick={() => setMode('forgot')}>
                Şifremi unuttum
              </button>
            ) : null}
            <button
              type="button"
              className="login-switch"
              onClick={() => {
                setMode(mode === 'register' ? 'login' : 'register');
                setError(null);
                setInfo(null);
                setPasswordRepeat('');
              }}
            >
              {mode === 'register' ? 'Zaten hesabın var mı? Giriş yap' : 'Hesabın yok mu? Kayıt ol'}
            </button>
            {mode === 'forgot' || mode === 'reset' ? (
              <button type="button" className="login-switch" onClick={() => setMode('login')}>
                Girişe dön
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
};
