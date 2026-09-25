import { useEffect, useState, type FormEvent } from 'react';
import { Minus, Package, Plus, Trash2 } from 'lucide-react';
import {
  apiErrorMessage,
  consumeClientPackage,
  createClientPackage,
  deleteClientPackage,
  getClientPackages,
} from '../services/api';
import type { SessionPackage } from '../types';
import { packageRunningLow } from '../types';
import { useConfirm } from '../contexts/ConfirmDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, FormError, Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/page';

export const SessionPackages = ({ clientId }: { clientId: number }) => {
  const { confirm } = useConfirm();
  const [packs, setPacks] = useState<SessionPackage[]>([]);
  const [title, setTitle] = useState('Seans paketi');
  const [total, setTotal] = useState(8);
  const [prepaid, setPrepaid] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setPacks(await getClientPackages(clientId));
      setError(null);
    } catch (err) {
      setError(apiErrorMessage(err, 'Paketler yüklenemedi.'));
    }
  };

  useEffect(() => {
    void load();
  }, [clientId]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await createClientPackage(clientId, { title, totalSessions: total, prepaidAmount: prepaid });
      setTitle('Seans paketi');
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Paket eklenemedi.'));
    }
  };

  const handleConsume = async (pack: SessionPackage) => {
    try {
      await consumeClientPackage(clientId, pack.id);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Seans düşülemedi.'));
    }
  };

  const handleDelete = async (pack: SessionPackage) => {
    const ok = await confirm({
      title: 'Paketi sil',
      message: `${pack.title} silinsin mi? Kalan ${pack.remainingSessions} seans bilgisi kaybolur.`,
      confirmLabel: 'Sil',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteClientPackage(clientId, pack.id);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Paket silinemedi.'));
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-3">
        {error ? <FormError>{error}</FormError> : null}
        {packs.length === 0 ? (
          <Card>
            <EmptyState icon={Package} title="Henüz paket yok" hint="Peşin ödenen seans paketlerini buradan takip edebilirsiniz." />
          </Card>
        ) : (
          packs.map((pack) => {
            const used = pack.totalSessions - pack.remainingSessions;
            const percent = pack.totalSessions === 0 ? 0 : Math.round((used / pack.totalSessions) * 100);
            return (
              <Card key={pack.id} className="p-4">
                <div className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                    <Package className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="m-0 flex items-center gap-2 text-sm font-semibold">
                      <span className="truncate">{pack.title}</span>
                      {packageRunningLow(pack) ? <Badge variant="warning">Bitmek üzere</Badge> : null}
                    </p>
                    <p className="m-0 text-[13px] text-muted-foreground">
                      {pack.remainingSessions} / {pack.totalSessions} seans kaldı
                      {pack.prepaidAmount ? ` · ${pack.prepaidAmount.toLocaleString('tr-TR')} ₺ peşin` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {pack.remainingSessions > 0 ? (
                      <Button variant="outline" size="sm" onClick={() => void handleConsume(pack)}>
                        <Minus />
                        Bir seans düş
                      </Button>
                    ) : null}
                    <Button variant="ghost" size="icon-sm" onClick={() => void handleDelete(pack)} aria-label={`${pack.title} paketini sil`}>
                      <Trash2 />
                    </Button>
                  </div>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${percent}%` }} />
                </div>
              </Card>
            );
          })
        )}
      </div>
      <Card className="h-fit p-5">
        <h2 className="m-0 text-[15px] font-semibold">Yeni paket</h2>
        <form className="mt-4 flex flex-col gap-3" onSubmit={handleCreate}>
          <Field label="Paket adı" htmlFor="pkg-title">
            <Input id="pkg-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Seans sayısı" htmlFor="pkg-total">
              <Input id="pkg-total" type="number" min={1} max={100} value={total} onChange={(e) => setTotal(Number(e.target.value))} />
            </Field>
            <Field label="Peşin tutar (₺)" htmlFor="pkg-prepaid">
              <Input id="pkg-prepaid" type="number" min={0} value={prepaid} onChange={(e) => setPrepaid(Number(e.target.value))} />
            </Field>
          </div>
          <Button type="submit" className="self-start">
            <Plus />
            Paket ekle
          </Button>
        </form>
      </Card>
    </div>
  );
};
