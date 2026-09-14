import { useEffect, useState, type FormEvent } from 'react';
import {
  apiErrorMessage,
  changePassword,
  clearStoredToken,
  deleteAccount,
  disconnectGoogle,
  exportAccount,
  getGoogleAuthUrl,
  getProfile,
  updateProfile,
} from '../services/api';
import type { Profile } from '../types';
import { useToast } from '../contexts/ToastContext';
import './Account.css';

export const Account = () => {
  const { showToast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [reminderHours, setReminderHours] = useState(24);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const data = await getProfile();
      setProfile(data);
      setDisplayName(data.displayName);
      setEmail(data.email || '');
      setReminderHours(data.reminderHours);
    } catch (err) {
      setError(apiErrorMessage(err, 'Hesap bilgisi alınamadı.'));
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleProfile = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const data = await updateProfile({ displayName, email, reminderHours });
      setProfile(data);
      showToast('Hesap bilgileri kaydedildi.');
    } catch (err) {
      setError(apiErrorMessage(err, 'Kaydedilemedi.'));
    } finally {
      setSaving(false);
    }
  };

  const handlePassword = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      showToast('Şifre güncellendi.');
    } catch (err) {
      setError(apiErrorMessage(err, 'Şifre değiştirilemedi.'));
    }
  };

  const handleGoogle = async () => {
    setError(null);
    try {
      if (profile?.googleConnected) {
        await disconnectGoogle();
        await load();
        showToast('Google bağlantısı kesildi.');
      } else {
        window.location.href = await getGoogleAuthUrl();
      }
    } catch (err) {
      setError(apiErrorMessage(err, 'Google işlemi tamamlanamadı.'));
    }
  };

  const handleExport = async () => {
    try {
      const data = await exportAccount();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'testpsikolog-kvkk-export.json';
      link.click();
      URL.revokeObjectURL(url);
      showToast('Veri dışa aktarıldı.');
    } catch (err) {
      setError(apiErrorMessage(err, 'Dışa aktarma başarısız.'));
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Hesabınız, danışanlarınız ve notlarınız kalıcı silinsin mi?')) return;
    try {
      await deleteAccount();
      clearStoredToken();
      window.location.href = '/';
    } catch (err) {
      setError(apiErrorMessage(err, 'Hesap silinemedi.'));
    }
  };

  if (!profile) {
    return (
      <div className="account-page">
        <p>{error || 'Yükleniyor...'}</p>
      </div>
    );
  }

  return (
    <div className="account-page">
      <h1>Hesap</h1>
      <p className="account-lead">
        Görünen ad klinik listesinde çıkar. KVKK kapsamında verilerinizi indirebilir veya hesabı silebilirsiniz.
      </p>
      {error ? <div className="account-error">{error}</div> : null}

      <form className="account-card" onSubmit={handleProfile}>
        <h2>Profil</h2>
        <label htmlFor="displayName">Görünen ad</label>
        <input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
        <label htmlFor="accountEmail">E-posta</label>
        <input id="accountEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label htmlFor="reminderHours">Yaklaşan seans uyarısı</label>
        <select
          id="reminderHours"
          value={reminderHours}
          onChange={(e) => setReminderHours(Number(e.target.value))}
        >
          <option value={2}>2 saat</option>
          <option value={12}>12 saat</option>
          <option value={24}>24 saat</option>
          <option value={48}>48 saat</option>
        </select>
        <button type="submit" disabled={saving}>
          Kaydet
        </button>
      </form>

      <form className="account-card" onSubmit={handlePassword}>
        <h2>Şifre değiştir</h2>
        <label htmlFor="currentPassword">Mevcut şifre</label>
        <input
          id="currentPassword"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
        />
        <label htmlFor="newPassword">Yeni şifre</label>
        <input
          id="newPassword"
          type="password"
          minLength={6}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
        />
        <button type="submit">Şifreyi güncelle</button>
      </form>

      <section className="account-card">
        <h2>Google Takvim</h2>
        <p>{profile.googleConnected ? 'Takvim bağlı.' : 'Takvim bağlı değil.'}</p>
        <button type="button" onClick={() => void handleGoogle()}>
          {profile.googleConnected ? 'Bağlantıyı kes' : 'Google bağla'}
        </button>
      </section>

      <section className="account-card">
        <h2>KVKK</h2>
        <p>Danışan, randevu ve not kayıtlarınızı JSON olarak indirebilirsiniz.</p>
        <button type="button" onClick={() => void handleExport()}>
          Verilerimi indir
        </button>
        <button type="button" className="account-danger" onClick={() => void handleDelete()}>
          Hesabı sil
        </button>
      </section>
    </div>
  );
};
