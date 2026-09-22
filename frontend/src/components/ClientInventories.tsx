import { useEffect, useState, type FormEvent } from 'react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { ClipboardList, Check } from 'lucide-react';
import {
  apiErrorMessage,
  getClientInventoryResults,
  getInventory,
  listInventories,
  submitClientInventory,
} from '../services/api';
import type { InventoryDetail, InventoryResult, InventorySummary } from '../types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, FormError, NativeSelect } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/page';
import { cn } from '@/lib/utils';

const SCALE = [
  { value: 0, label: 'Hiç' },
  { value: 1, label: 'Birkaç gün' },
  { value: 2, label: 'Yarısından fazla' },
  { value: 3, label: 'Hemen her gün' },
];

export const ClientInventories = ({ clientId }: { clientId: number }) => {
  const [catalog, setCatalog] = useState<InventorySummary[]>([]);
  const [results, setResults] = useState<InventoryResult[]>([]);
  const [selectedId, setSelectedId] = useState<number>(0);
  const [detail, setDetail] = useState<InventoryDetail | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const [list, history] = await Promise.all([listInventories(), getClientInventoryResults(clientId)]);
      setCatalog(list);
      setResults(history);
      setError(null);
    } catch (err) {
      setError(apiErrorMessage(err, 'Ölçekler yüklenemedi.'));
    }
  };

  useEffect(() => {
    void load();
  }, [clientId]);

  const handleSelect = async (id: number) => {
    setSelectedId(id);
    if (!id) {
      setDetail(null);
      return;
    }
    try {
      const data = await getInventory(id);
      setDetail(data);
      setAnswers(data.items.map(() => 0));
    } catch (err) {
      setError(apiErrorMessage(err, 'Ölçek açılamadı.'));
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    try {
      await submitClientInventory(clientId, selectedId, answers);
      setDetail(null);
      setSelectedId(0);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Ölçek kaydedilemedi.'));
    }
  };

  const currentScore = answers.reduce((sum, value) => sum + value, 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <Card className="min-w-0 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <Field label="Ölçek" htmlFor="inventory-select" className="flex-1">
            <NativeSelect id="inventory-select" value={selectedId} onChange={(e) => void handleSelect(Number(e.target.value))}>
              <option value={0}>Bir ölçek seçin</option>
              {catalog.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
        <p className="m-0 mt-2 text-xs text-muted-foreground">PHQ-9 ve GAD-7 tarama ölçekleridir; tanı koymaz.</p>
        {error ? <div className="mt-3"><FormError>{error}</FormError></div> : null}

        {detail ? (
          <form className="mt-5 flex flex-col gap-4" onSubmit={handleSubmit}>
            <p className="m-0 rounded-lg bg-muted/60 p-3 text-[13px] leading-relaxed text-muted-foreground">{detail.description}</p>
            <ol className="m-0 flex list-none flex-col gap-4 p-0">
              {detail.items.map((item, index) => (
                <li key={item.id}>
                  <fieldset className="m-0 border-0 p-0">
                    <legend className="mb-2 p-0 text-sm font-medium">
                      <span className="mr-1.5 text-muted-foreground">{item.sortOrder}.</span>
                      {item.prompt}
                    </legend>
                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                      {SCALE.map((option) => {
                        const active = answers[index] === option.value;
                        return (
                          <label
                            key={option.value}
                            className={cn(
                              'flex cursor-pointer items-center justify-center rounded-md border border-solid px-2 py-2 text-center text-[13px] transition-colors',
                              active ? 'border-primary bg-primary/10 font-medium text-foreground' : 'border-input bg-card text-muted-foreground hover:bg-accent'
                            )}
                          >
                            <input
                              type="radio"
                              name={`inv-${item.id}`}
                              className="sr-only"
                              checked={active}
                              onChange={() =>
                                setAnswers((current) => current.map((value, i) => (i === index ? option.value : value)))
                              }
                            />
                            {option.label}
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                </li>
              ))}
            </ol>
            <div className="flex items-center justify-between rounded-lg border border-solid px-4 py-3">
              <span className="text-sm text-muted-foreground">
                Ara toplam: <span className="font-semibold text-foreground">{currentScore}</span> / {detail.maxScore}
              </span>
              <Button type="submit">
                <Check />
                Skoru kaydet
              </Button>
            </div>
          </form>
        ) : null}
      </Card>

      <Card className="h-fit overflow-hidden">
        <div className="px-5 pt-5">
          <h2 className="m-0 text-[15px] font-semibold">Geçmiş sonuçlar</h2>
        </div>
        {results.length === 0 ? (
          <EmptyState icon={ClipboardList} title="Henüz sonuç yok" hint="Bir ölçek doldurduğunuzda burada listelenir." />
        ) : (
          <ul className="m-0 mt-3 list-none divide-y divide-border p-0">
            {results.map((row) => {
              const percent = row.maxScore ? Math.round((row.score / row.maxScore) * 100) : 0;
              return (
                <li key={row.id} className="px-5 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-sm font-medium">{row.inventoryName}</span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">
                      {row.score}
                      <span className="font-normal text-muted-foreground">/{row.maxScore}</span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
                  </div>
                  <p className="m-0 mt-1.5 text-xs text-muted-foreground">
                    {row.interpretation} · {format(new Date(row.createdAt), 'd MMM yyyy', { locale: tr })}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
};
