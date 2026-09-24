import { useEffect, useState, type FormEvent } from 'react';
import { Building2, Loader2 } from 'lucide-react';
import { acceptInvitation, apiErrorMessage, getInvitationPreview, setStoredToken } from '../services/api';
import type { InvitationPreview } from '../types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, FormError, Input } from '@/components/ui/input';

type Props = {
  token: string;
  onAccepted: () => void;
};

/** Giriş yapmadan açılan davet sayfası: yeni hesap oluşturur veya mevcut hesabı kliniğe bağlar. */
export const InviteAccept = ({ token, onAccepted }: Props) => {
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getInvitationPreview(token)
      .then(setPreview)
      .catch((err) => setError(apiErrorMessage(err, 'Davet bulunamadı veya süresi doldu.')))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!preview) return;
    setError(null);
    setSubmitting(true);
    try {
      const result = await acceptInvitation(token, password, preview.accountExists ? undefined : displayName.trim() || undefined);
      setStoredToken(result.token);
      onAccepted();
    } catch (err) {
      setError(apiErrorMessage(err, 'Davet kabul edilemedi.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md p-6">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin" />
          </div>
        ) : !preview ? (
          <FormError>{error ?? 'Davet bulunamadı veya süresi doldu.'}</FormError>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <span className="flex size-10 items-center justify-center rounded-lg bg-accent text-primary">
              <Building2 className="size-5" />
            </span>
            <div>
              <h1 className="m-0 text-lg font-semibold">{preview.clinicName} kliniğine davetlisiniz</h1>
              <p className="m-0 mt-1 text-sm text-muted-foreground">
                {preview.accountExists
                  ? `${preview.email} hesabınızın şifresini girerek kliniğe katılın.`
                  : `${preview.email} için hesabınızı oluşturun; şifreyi siz belirlersiniz.`}
              </p>
            </div>
            {error ? <FormError>{error}</FormError> : null}
            {!preview.accountExists ? (
              <Field label="Görünen ad" htmlFor="invite-name">
                <Input id="invite-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </Field>
            ) : null}
            <Field label="Şifre" htmlFor="invite-password" hint={preview.accountExists ? undefined : 'En az 6 karakter'}>
              <Input
                id="invite-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={preview.accountExists ? 'current-password' : 'new-password'}
                required
              />
            </Field>
            <Button type="submit" disabled={submitting}>
              {preview.accountExists ? 'Kliniğe katıl' : 'Hesap oluştur ve katıl'}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
};
