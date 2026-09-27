import { useCallback, useEffect, useState } from 'react';
import { UserCog } from 'lucide-react';
import { apiErrorMessage, assignClient, getUnassignedClients } from '../services/api';
import type { Clinic, UnassignedClient } from '../types';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormError, NativeSelect } from '@/components/ui/input';
import { Avatar } from '@/components/ui/page';

/**
 * K7: bir psikolog klinikten ayrılınca/çıkarılınca danışanları kişisel olmaz, kliniğe bağlı kalır ama
 * sahipsiz kalır. Sahip ya da sekreter burada başka bir psikoloğa atar; atanana kadar kimse (sahip dahil)
 * danışanın notuna, geçmişine ulaşamaz.
 */
export const UnassignedClients = ({ clinic }: { clinic: Clinic }) => {
  const [clients, setClients] = useState<UnassignedClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<number, number>>({});
  const [assigning, setAssigning] = useState<number | null>(null);

  const therapists = clinic.members.filter((m) => m.role !== 'secretary');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setClients(await getUnassignedClients());
    } catch (err) {
      setError(apiErrorMessage(err, 'Sahipsiz danışanlar alınamadı.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!loading && clients.length === 0) {
    return null;
  }

  const handleAssign = async (clientId: number) => {
    const userId = selected[clientId] ?? therapists[0]?.userId;
    if (!userId) return;
    setError(null);
    setAssigning(clientId);
    try {
      await assignClient(clientId, userId);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Danışan atanamadı.'));
    } finally {
      setAssigning(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Sahipsiz danışanlar</CardTitle>
          <CardDescription className="mt-1">
            Klinikten ayrılan ya da çıkarılan bir psikoloğun danışanları burada bekler; atanana kadar kimse
            notuna ve geçmişine ulaşamaz.
          </CardDescription>
        </div>
        <UserCog className="size-4 text-muted-foreground" />
      </CardHeader>
      {error ? (
        <div className="px-5 pt-3">
          <FormError>{error}</FormError>
        </div>
      ) : null}
      <ul className="m-0 mt-3 list-none divide-y divide-border p-0 pb-2">
        {clients.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
            <Avatar name={c.name || c.email || 'İsimsiz'} className="size-8 text-xs" />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.name || c.email || 'İsimsiz'}</span>
            <NativeSelect
              className="w-auto"
              value={selected[c.id] ?? therapists[0]?.userId ?? ''}
              onChange={(e) => setSelected((prev) => ({ ...prev, [c.id]: Number(e.target.value) }))}
              aria-label={`${c.name} için psikolog seç`}
            >
              {therapists.map((t) => (
                <option key={t.userId} value={t.userId}>
                  {t.name}
                </option>
              ))}
            </NativeSelect>
            <Button
              variant="outline"
              size="sm"
              disabled={assigning === c.id || therapists.length === 0}
              onClick={() => void handleAssign(c.id)}
            >
              Ata
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
};
