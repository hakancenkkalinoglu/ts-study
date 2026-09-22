import { useState, useEffect, type FormEvent } from 'react';
import { CalendarDays, Loader2, NotebookPen, ShieldCheck } from 'lucide-react';
import {
  login,
  register,
  setStoredToken,
  getGoogleLoginUrl,
  forgotPassword,
  resetPassword,
  apiErrorMessage,
} from '../services/api';
import { Button } from '@/components/ui/button';
import { Field, FormError, Input } from '@/components/ui/input';

interface LoginProps {
  onSuccess: () => void;
  bootstrapping?: boolean;
}

type Mode = 'login' | 'register' | 'forgot' | 'reset';

const MODE_TITLES: Record<Mode, { title: string; subtitle: string }> = {
  login: { title: 'Tekrar hoş geldiniz', subtitle: 'Hesabınıza giriş yapın.' },
  register: { title: 'Hesap oluşturun', subtitle: 'Birkaç saniyede kullanmaya başlayın.' },
  forgot: { title: 'Şifremi unuttum', subtitle: 'E-postanızı girin, size bir sıfırlama kodu oluşturalım.' },
  reset: { title: 'Yeni şifre belirleyin', subtitle: 'Sıfırlama kodunu ve yeni şifrenizi girin.' },
};

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
    <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7Z" />
    <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9h-4v3.1A12 12 0 0 0 12 24Z" />
    <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.7V6.6h-4a12 12 0 0 0 0 10.9l4-3.1Z" />
    <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A11.6 11.6 0 0 0 12 0 12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z" />
  </svg>
);

const FEATURES = [
  { icon: CalendarDays, text: 'Takvim, oda ve kapalı saatler tek yerde' },
  { icon: NotebookPen, text: 'Seans notları, ekler ve ölçek sonuçları' },
  { icon: ShieldCheck, text: 'Danışan bilgisi meslektaşlarınıza gizli kalır' },
];

export const Login = ({ onSuccess, bootstrapping = false }: LoginProps) => {
  const [mode, setMode] = useState<Mode>('login');
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

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setInfo(null);
    setPasswordRepeat('');
  };

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

  const submitLabel =
    mode === 'register' ? 'Kayıt ol' : mode === 'forgot' ? 'Kod oluştur' : mode === 'reset' ? 'Şifreyi sıfırla' : 'Giriş yap';

  return (
    <div className="grid min-h-screen bg-background font-sans text-foreground lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-[#3b2416] p-12 text-[#f6ebe0] lg:flex">
        <div className="absolute -right-24 -top-24 size-96 rounded-full bg-[#7a4a2b]/40 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 size-96 rounded-full bg-[#a9774f]/25 blur-3xl" />
        <div className="relative flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-[#f6ebe0] text-sm font-semibold text-[#3b2416]">
            TP
          </div>
          <span className="text-base font-semibold">TestPsikolog</span>
        </div>
        <div className="relative max-w-md">
          <h2 className="m-0 text-3xl font-semibold leading-tight tracking-tight">
            Danışanlarınıza odaklanın, gerisini biz düzenleyelim.
          </h2>
          <ul className="m-0 mt-8 flex list-none flex-col gap-4 p-0">
            {FEATURES.map((item) => (
              <li key={item.text} className="flex items-center gap-3 text-[15px] text-[#e8d5c4]">
                <span className="flex size-8 items-center justify-center rounded-lg bg-white/10">
                  <item.icon className="size-4" />
                </span>
                {item.text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative m-0 text-[13px] text-[#c4a882]">Psikologlar ve ortak muayenehaneler için.</p>
      </aside>

      <main className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
              TP
            </div>
            <span className="text-base font-semibold">TestPsikolog</span>
          </div>

          {bootstrapping ? (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Google girişi tamamlanıyor...
            </div>
          ) : (
            <>
              <h1 className="m-0 text-2xl font-semibold tracking-tight">{MODE_TITLES[mode].title}</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">{MODE_TITLES[mode].subtitle}</p>

              {mode === 'login' || mode === 'register' ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-6 h-10 w-full"
                    onClick={handleGoogle}
                    disabled={loading || googleLoading}
                  >
                    {googleLoading ? <Loader2 className="animate-spin" /> : <GoogleIcon />}
                    {googleLoading ? 'Google açılıyor...' : 'Google ile devam et'}
                  </Button>
                  <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="h-px flex-1 bg-border" />
                    veya e-posta ile
                    <span className="h-px flex-1 bg-border" />
                  </div>
                </>
              ) : (
                <div className="mt-6" />
              )}

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {mode === 'register' ? (
                  <Field label="Görünen ad" htmlFor="displayName">
                    <Input
                      id="displayName"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      autoComplete="name"
                      placeholder="Dr. Ayşe Yılmaz"
                    />
                  </Field>
                ) : null}
                <Field label="E-posta" htmlFor="email">
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    placeholder="ornek@eposta.com"
                    required
                  />
                </Field>
                {mode === 'reset' ? (
                  <Field label="Sıfırlama kodu" htmlFor="resetCode">
                    <Input
                      id="resetCode"
                      value={resetCode}
                      onChange={(e) => setResetCode(e.target.value)}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      required
                    />
                  </Field>
                ) : null}
                {mode !== 'forgot' ? (
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <label htmlFor="password" className="text-[13px] font-medium">
                        {mode === 'reset' ? 'Yeni şifre' : 'Şifre'}
                      </label>
                      {mode === 'login' ? (
                        <button
                          type="button"
                          onClick={() => switchMode('forgot')}
                          className="cursor-pointer border-0 bg-transparent p-0 text-[13px] font-medium text-primary [font-family:inherit] hover:underline"
                        >
                          Şifremi unuttum
                        </button>
                      ) : null}
                    </div>
                    <Input
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
                {mode === 'register' ? (
                  <Field label="Şifre tekrar" htmlFor="passwordRepeat">
                    <Input
                      id="passwordRepeat"
                      type="password"
                      value={passwordRepeat}
                      onChange={(e) => setPasswordRepeat(e.target.value)}
                      autoComplete="new-password"
                      required
                      minLength={6}
                    />
                  </Field>
                ) : null}
                {mode === 'register' ? (
                  <label className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-snug text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={kvkkAccepted}
                      onChange={(e) => setKvkkAccepted(e.target.checked)}
                      className="mt-0.5 size-4 shrink-0 cursor-pointer accent-[var(--primary)]"
                    />
                    Klinik notların gizliliğini koruyacağımı ve KVKK aydınlatmasını okuduğumu onaylıyorum.
                  </label>
                ) : null}
                <FormError>{error}</FormError>
                {info ? (
                  <div role="status" className="rounded-md border border-solid border-success/25 bg-success/8 px-3 py-2 text-[13px] text-success">
                    {info}
                  </div>
                ) : null}
                <Button type="submit" className="h-10 w-full" disabled={loading || googleLoading}>
                  {loading ? <Loader2 className="animate-spin" /> : null}
                  {loading ? 'İşleniyor...' : submitLabel}
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                {mode === 'login' ? (
                  <>
                    Hesabınız yok mu?{' '}
                    <LinkButton onClick={() => switchMode('register')}>Kayıt olun</LinkButton>
                  </>
                ) : mode === 'register' ? (
                  <>
                    Zaten hesabınız var mı?{' '}
                    <LinkButton onClick={() => switchMode('login')}>Giriş yapın</LinkButton>
                  </>
                ) : (
                  <LinkButton onClick={() => switchMode('login')}>Girişe dön</LinkButton>
                )}
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

const LinkButton = ({ onClick, children }: { onClick: () => void; children: string }) => (
  <button
    type="button"
    onClick={onClick}
    className="cursor-pointer border-0 bg-transparent p-0 text-sm font-medium text-primary [font-family:inherit] hover:underline"
  >
    {children}
  </button>
);
