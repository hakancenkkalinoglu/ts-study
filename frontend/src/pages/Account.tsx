import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { CalendarDays, Download, KeyRound, Link2Off, Loader2, Trash2, UserRound } from 'lucide-react';
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
import { useConfirm } from '../contexts/ConfirmDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, FormError, Input, NativeSelect } from '@/components/ui/input';
import { Avatar, LoadingRows, PageContainer, PageHeader } from '@/components/ui/page';
import { cn } from '@/lib/utils';

const Section = ({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
}) => (
  <Card className={cn('grid gap-5 p-5 md:grid-cols-[240px_minmax(0,1fr)] md:gap-8 md:p-6', className)}>
    <div>
      <h2 className="m-0 text-[15px] font-semibold">{title}</h2>
      <p className="m-0 mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
    <div className="min-w-0">{children}</div>
  </Card>
);

export const Account = () => {
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [reminderHours, setReminderHours] = useState(24);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

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
    setSavingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      showToast('Şifre güncellendi. Diğer cihazlardaki oturumlar kapatıldı.');
    } catch (err) {
      setError(apiErrorMessage(err, 'Şifre değiştirilemedi.'));
    } finally {
      setSavingPassword(false);
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
    const ok = await confirm({
      title: 'Hesabı kalıcı sil',
      message: 'Hesabınız, danışanlarınız, notlarınız ve ekleriniz kalıcı silinir. Bu işlem geri alınamaz.',
      confirmLabel: 'Hesabı sil',
      danger: true,
    });
    if (!ok) return;
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
      <PageContainer className="max-w-4xl">
        <PageHeader title="Hesap" />
        {error ? <FormError>{error}</FormError> : (
          <Card>
            <LoadingRows />
          </Card>
        )}
      </PageContainer>
    );
  }

  return (
    <PageContainer className="max-w-4xl">
      <PageHeader title="Hesap" description="Profilinizi, güvenliği ve bağlantılarınızı yönetin." />
      {error ? <div className="mb-4"><FormError>{error}</FormError></div> : null}

      <div className="flex flex-col gap-6">
        <Section title="Profil" description="Görünen adınız klinik listesinde ve takvimde görünür.">
          <form onSubmit={handleProfile} className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <Avatar name={displayName || email} className="size-12 text-base" />
              <div className="min-w-0">
                <p className="m-0 truncate text-sm font-medium">{profile.displayName}</p>
                <p className="m-0 truncate text-[13px] text-muted-foreground">{profile.email}</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Görünen ad" htmlFor="displayName">
                <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
              </Field>
              <Field label="E-posta" htmlFor="accountEmail">
                <Input id="accountEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </Field>
            </div>
            <Field label="Yaklaşan seans uyarısı" htmlFor="reminderHours" hint="Bugün ekranındaki 'Yaklaşan' listesi bu süreye göre dolar.">
              <NativeSelect id="reminderHours" value={reminderHours} onChange={(e) => setReminderHours(Number(e.target.value))} className="sm:w-60">
                <option value={2}>2 saat önce</option>
                <option value={12}>12 saat önce</option>
                <option value={24}>24 saat önce</option>
                <option value={48}>48 saat önce</option>
              </NativeSelect>
            </Field>
            <div>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="animate-spin" /> : <UserRound />}
                Kaydet
              </Button>
            </div>
          </form>
        </Section>

        <Section title="Şifre" description="Şifreyi değiştirdiğinizde diğer cihazlardaki oturumlar kapanır.">
          <form onSubmit={handlePassword} className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Mevcut şifre" htmlFor="currentPassword">
                <Input
                  id="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </Field>
              <Field label="Yeni şifre" htmlFor="newPassword" hint="En az 6 karakter.">
                <Input
                  id="newPassword"
                  type="password"
                  autoComplete="new-password"
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </Field>
            </div>
            <div>
              <Button type="submit" variant="outline" disabled={savingPassword}>
                {savingPassword ? <Loader2 className="animate-spin" /> : <KeyRound />}
                Şifreyi güncelle
              </Button>
            </div>
          </form>
        </Section>

        <Section title="Google Takvim" description="Bağlıysa yeni randevular takviminize eklenir ve Meet linki oluşturulabilir.">
          <div className="flex flex-col gap-4 rounded-lg border border-solid p-4 sm:flex-row sm:items-center">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
              <CalendarDays className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="m-0 text-sm font-medium">Google Takvim</p>
              <div className="mt-1">
                {profile.googleConnected ? <Badge variant="success">Bağlı</Badge> : <Badge>Bağlı değil</Badge>}
              </div>
            </div>
            <Button variant={profile.googleConnected ? 'ghost' : 'default'} onClick={() => void handleGoogle()}>
              {profile.googleConnected ? <Link2Off /> : null}
              {profile.googleConnected ? 'Bağlantıyı kes' : 'Google’ı bağla'}
            </Button>
          </div>
        </Section>

        <Section title="Verileriniz (KVKK)" description="Danışan, randevu ve not kayıtlarınızı indirin veya hesabınızı kalıcı silin.">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 rounded-lg border border-solid p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="m-0 text-sm font-medium">Verilerimi indir</p>
                <p className="m-0 text-[13px] text-muted-foreground">Tüm kayıtlarınız tek bir JSON dosyası olarak iner.</p>
              </div>
              <Button variant="outline" onClick={() => void handleExport()}>
                <Download />
                İndir
              </Button>
            </div>
            <div className="flex flex-col gap-3 rounded-lg border border-solid border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="m-0 text-sm font-medium text-destructive">Hesabı sil</p>
                <p className="m-0 text-[13px] text-muted-foreground">Geri alınamaz. Kurucusu olduğunuz bir klinik varsa önce devredin.</p>
              </div>
              <Button variant="destructive" onClick={() => void handleDelete()}>
                <Trash2 />
                Hesabı sil
              </Button>
            </div>
          </div>
        </Section>
      </div>
    </PageContainer>
  );
};
