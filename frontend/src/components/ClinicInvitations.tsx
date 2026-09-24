import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Check, Copy, MailPlus, X } from 'lucide-react';
import { apiErrorMessage, createClinicInvitation, getClinicInvitations, revokeClinicInvitation } from '../services/api';
import type { Invitation } from '../types';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormError, Input } from '@/components/ui/input';

const formatExpiry = (expiresAt: number) => new Date(expiresAt).toLocaleDateString('tr-TR');

/** Yeni psikologu e-postayla davet eder. E-posta gönderilmez; oluşan bağlantı kopyalanıp iletilir. */
export const ClinicInvitations = () => {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fresh, setFresh] = useState<Invitation | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      setInvitations(await getClinicInvitations());
    } catch (err) {
      setError(apiErrorMessage(err, 'Davetler alınamadı.'));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const created = await createClinicInvitation(email);
      setFresh(created);
      setCopied(false);
      setEmail('');
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Davet oluşturulamadı.'));
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = async () => {
    if (!fresh?.inviteUrl) return;
    try {
      await navigator.clipboard.writeText(fresh.inviteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Bağlantı kopyalanamadı.');
    }
  };

  const handleRevoke = async (id: number) => {
    setError(null);
    try {
      await revokeClinicInvitation(id);
      if (fresh?.id === id) setFresh(null);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Davet iptal edilemedi.'));
    }
  };

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Psikolog davet et</CardTitle>
          <CardDescription className="mt-1">
            E-posta adresine özel, 7 gün geçerli, tek kullanımlık bağlantı oluşturulur. Psikolog şifresini kendisi belirler.
          </CardDescription>
        </div>
        <MailPlus className="size-4 text-muted-foreground" />
      </CardHeader>
      <form onSubmit={handleSubmit} className="flex items-center gap-2 px-5 pt-3">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="psikolog@ornek.com"
          aria-label="Davet edilecek e-posta"
          required
        />
        <Button type="submit" variant="outline" disabled={saving}>
          Davet oluştur
        </Button>
      </form>
      {error ? (
        <div className="px-5 pt-3">
          <FormError>{error}</FormError>
        </div>
      ) : null}
      {fresh?.inviteUrl ? (
        <div className="mx-5 mt-3 rounded-md border border-dashed border-input bg-muted/60 p-3">
          <p className="m-0 text-[13px] text-muted-foreground">
            {fresh.email} için bağlantı hazır. Bu bağlantı yalnızca şimdi görünür; psikologa kendiniz iletin.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate text-xs">{fresh.inviteUrl}</code>
            <Button type="button" variant="outline" size="sm" onClick={() => void handleCopy()}>
              {copied ? <Check /> : <Copy />}
              {copied ? 'Kopyalandı' : 'Kopyala'}
            </Button>
          </div>
        </div>
      ) : null}
      <ul className="m-0 mt-3 list-none divide-y divide-border p-0 pb-2">
        {invitations.length === 0 ? (
          <li className="px-5 py-3 text-sm text-muted-foreground">Bekleyen davet yok.</li>
        ) : (
          invitations.map((invitation) => (
            <li key={invitation.id} className="flex items-center gap-3 px-5 py-3">
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{invitation.email}</span>
              <span className="text-xs text-muted-foreground">{formatExpiry(invitation.expiresAt)} tarihine kadar</span>
              <Button variant="ghost" size="icon-sm" onClick={() => void handleRevoke(invitation.id)} aria-label="Daveti iptal et">
                <X />
              </Button>
            </li>
          ))
        )}
      </ul>
    </Card>
  );
};
