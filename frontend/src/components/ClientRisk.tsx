import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AlertTriangle, Loader2, Pencil, Plus } from 'lucide-react';
import { apiErrorMessage, getClientRisk, updateClientRisk } from '../services/api';
import { RISK_LEVELS, type ClientRisk as ClientRiskData, type RiskLevel } from '../types';
import { useToast } from '../contexts/ToastContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogBody, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field, FormError, NativeSelect, Textarea } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const NOTE_MAX = 500;

const LEVEL_BADGE: Record<RiskLevel, 'neutral' | 'warning' | 'danger'> = {
  low: 'neutral',
  medium: 'warning',
  high: 'danger',
};

const LEVEL_TONE: Record<RiskLevel, string> = {
  low: 'border-border bg-muted/40',
  medium: 'border-warning/40 bg-warning/10',
  high: 'border-destructive/40 bg-destructive/10',
};

const levelLabel = (level: RiskLevel) => RISK_LEVELS.find((item) => item.value === level)?.label ?? level;

/**
 * Danışanın risk / kriz işareti. Yalnızca danışan detay sayfasında görünür;
 * danışan listesinde ve klinik takviminde bilerek gösterilmez.
 */
export const ClientRisk = ({ clientId }: { clientId: number }) => {
  const { showToast } = useToast();
  const [risk, setRisk] = useState<ClientRiskData | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState<RiskLevel | ''>('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoadFailed(false);
      setRisk(await getClientRisk(clientId));
    } catch (err) {
      console.error('Error loading client risk:', err);
      setLoadFailed(true);
    }
  }, [clientId]);

  useEffect(() => {
    setRisk(null);
    void load();
  }, [load]);

  const openDialog = () => {
    setLevel(risk?.level ?? 'medium');
    setNote(risk?.note ?? '');
    setError(null);
    setOpen(true);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      await updateClientRisk(clientId, { level: level || null, note: note.trim() });
      setOpen(false);
      showToast('Risk işareti kaydedildi.');
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Risk işareti kaydedilemedi.'));
    } finally {
      setSaving(false);
    }
  };

  const clear = async () => {
    try {
      setSaving(true);
      setError(null);
      await updateClientRisk(clientId, { level: null });
      setOpen(false);
      showToast('Risk işareti kaldırıldı.');
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Risk işareti kaldırılamadı.'));
    } finally {
      setSaving(false);
    }
  };

  if (loadFailed) {
    return (
      <p className="m-0 mb-6 text-[13px] text-muted-foreground">
        Risk işareti yüklenemedi.{' '}
        <button type="button" onClick={() => void load()} className="cursor-pointer border-0 bg-transparent p-0 text-[13px] underline [font-family:inherit]">
          Tekrar dene
        </button>
      </p>
    );
  }

  if (!risk) return null;

  return (
    <>
      {risk.level ? (
        <Card className={cn('mb-6 flex items-start gap-3 border border-solid p-4', LEVEL_TONE[risk.level])} role="note">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">Risk işareti</span>
              <Badge variant={LEVEL_BADGE[risk.level]}>{levelLabel(risk.level)}</Badge>
            </div>
            {risk.note ? <p className="m-0 mt-1 whitespace-pre-wrap text-sm">{risk.note}</p> : null}
          </div>
          <Button variant="ghost" size="sm" onClick={openDialog}>
            <Pencil />
            Düzenle
          </Button>
        </Card>
      ) : (
        <div className="mb-6">
          <Button variant="outline" size="sm" onClick={openDialog}>
            <Plus />
            Risk işareti ekle
          </Button>
        </div>
      )}

      <Dialog open={open} onOpenChange={(next) => (next ? null : setOpen(false))}>
        <DialogContent title="Risk işareti" description="Yalnızca siz görürsünüz. Danışan listesinde ve klinik takviminde gösterilmez.">
          <form onSubmit={save}>
            <DialogBody>
              <Field label="Seviye *" htmlFor="risk-level">
                <NativeSelect id="risk-level" value={level} onChange={(e) => setLevel(e.target.value as RiskLevel | '')}>
                  {RISK_LEVELS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Kısa not" htmlFor="risk-note" hint={`${note.length}/${NOTE_MAX}`}>
                <Textarea id="risk-note" rows={3} maxLength={NOTE_MAX} value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>
              <FormError>{error}</FormError>
            </DialogBody>
            <DialogFooter>
              {risk.level ? (
                <Button type="button" variant="ghost" className="mr-auto text-destructive" disabled={saving} onClick={() => void clear()}>
                  İşareti kaldır
                </Button>
              ) : null}
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Vazgeç
              </Button>
              <Button type="submit" disabled={saving || !level}>
                {saving ? <Loader2 className="animate-spin" /> : null}
                Kaydet
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};
