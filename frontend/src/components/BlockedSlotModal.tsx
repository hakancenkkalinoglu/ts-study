import { useEffect, useState, type FormEvent } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import {
  apiErrorMessage,
  createBlockedSlot,
  deleteBlockedSlot,
  updateBlockedSlot,
} from '../services/api';
import type { BlockedSlot } from '../types';
import { sessionDuration } from '../types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field, FormError, Input, NativeSelect } from '@/components/ui/input';
import { useConfirm } from '../contexts/ConfirmDialog';

const DAY_MINUTES = 24 * 60;

const BLOCKED_DURATION_OPTIONS = [
  { value: 15, label: '15 dk' },
  { value: 30, label: '30 dk' },
  { value: 45, label: '45 dk' },
  { value: 50, label: '50 dk' },
  { value: 60, label: '1 saat' },
  { value: 90, label: '1,5 saat' },
  { value: 120, label: '2 saat' },
  { value: 180, label: '3 saat' },
  { value: 240, label: '4 saat' },
];

const parseTimeMinutes = (time: string) => {
  const part = (time || '09:00').slice(0, 5);
  const [hour, minute] = part.split(':').map(Number);
  return (hour || 0) * 60 + (minute || 0);
};

const minutesToTime = (total: number) => {
  const clamped = Math.max(0, Math.min(DAY_MINUTES, total));
  const hour = Math.floor(clamped / 60);
  const minute = clamped % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

const durationOptions = (minutes: number) => {
  const value = sessionDuration(minutes);
  if (BLOCKED_DURATION_OPTIONS.some((item) => item.value === value)) {
    return BLOCKED_DURATION_OPTIONS;
  }
  return [...BLOCKED_DURATION_OPTIONS, { value, label: `${value} dk` }].sort((a, b) => a.value - b.value);
};

export type BlockedSlotModalCreate = {
  mode: 'create';
  slotDate: string;
  startTime: string;
  durationMinutes: number;
};

export type BlockedSlotModalEdit = {
  mode: 'edit';
  slot: BlockedSlot;
};

export type BlockedSlotModalState = BlockedSlotModalCreate | BlockedSlotModalEdit | null;

interface BlockedSlotModalProps {
  state: BlockedSlotModalState;
  onClose: () => void;
  onSuccess: () => void;
}

export const BlockedSlotModal = ({ state, onClose, onSuccess }: BlockedSlotModalProps) => {
  const { confirm } = useConfirm();
  const isOpen = state !== null;
  const editing = state?.mode === 'edit' ? state.slot : null;

  const [slotDate, setSlotDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [durationMinutes, setDurationMinutes] = useState(50);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!state) return;
    setError(null);
    if (state.mode === 'edit') {
      const slot = state.slot;
      const start = parseTimeMinutes(slot.startTime);
      const end = parseTimeMinutes(slot.endTime);
      setSlotDate(slot.slotDate.slice(0, 10));
      setStartTime(minutesToTime(start));
      setDurationMinutes(Math.max(15, end - start));
      setTitle(slot.title && slot.title !== 'Kapalı' ? slot.title : '');
      return;
    }
    setSlotDate(state.slotDate);
    setStartTime(state.startTime.slice(0, 5));
    setDurationMinutes(sessionDuration(state.durationMinutes));
    setTitle('');
  }, [state]);

  const buildEndTime = () => {
    const start = parseTimeMinutes(startTime);
    const end = Math.min(DAY_MINUTES, start + durationMinutes);
    if (end - start < 15) {
      return null;
    }
    return minutesToTime(end);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const endTime = buildEndTime();
    if (!endTime) {
      setError('Kapalı aralık en az 15 dakika olmalı.');
      return;
    }
    setLoading(true);
    setError(null);
    const payload = {
      slotDate,
      startTime: startTime.slice(0, 5),
      endTime,
      title: title.trim() || undefined,
    };
    try {
      if (editing) {
        await updateBlockedSlot(editing.id, payload);
      } else {
        await createBlockedSlot(payload);
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, editing ? 'Kapalı saat güncellenemedi.' : 'Kapalı saat eklenemedi.'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!editing) return;
    const ok = await confirm({
      title: 'Kapalı saati sil',
      message: 'Bu kapalı saat silinsin mi?',
      confirmLabel: 'Sil',
      danger: true,
    });
    if (!ok) return;
    setLoading(true);
    setError(null);
    try {
      await deleteBlockedSlot(editing.id);
      onSuccess();
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, 'Kapalı saat silinemedi.'));
    } finally {
      setLoading(false);
    }
  };

  const endPreview = buildEndTime();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent
        title={editing ? 'Kapalı saati düzenle' : 'Kapalı saat ekle'}
        description={
          editing
            ? 'Takvimde randevu alınamayan aralığı güncelleyin.'
            : 'Bu saat aralığında randevu oluşturulamaz.'
        }
        className="max-w-md"
      >
        <form onSubmit={(e) => void handleSubmit(e)}>
          <DialogBody className="gap-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Tarih *" htmlFor="blockedDate" className="col-span-2 sm:col-span-1">
                <Input
                  type="date"
                  id="blockedDate"
                  required
                  value={slotDate}
                  onChange={(e) => setSlotDate(e.target.value)}
                />
              </Field>
              <Field label="Başlangıç *" htmlFor="blockedStart">
                <Input
                  type="time"
                  id="blockedStart"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </Field>
            </div>
            <Field
              label="Süre *"
              htmlFor="blockedDuration"
              hint={endPreview ? `Bitiş: ${endPreview}` : undefined}
            >
              <NativeSelect
                id="blockedDuration"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(sessionDuration(Number(e.target.value)))}
              >
                {durationOptions(durationMinutes).map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Başlık" htmlFor="blockedTitle" hint="Takvimde görünen metin. Boş bırakılırsa “Kapalı” yazılır.">
              <Input
                id="blockedTitle"
                placeholder="Örn. Öğle arası, Toplantı"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={80}
              />
            </Field>
            <FormError>{error}</FormError>
          </DialogBody>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            {editing ? (
              <Button
                type="button"
                variant="outline"
                className="text-destructive sm:mr-auto"
                disabled={loading}
                onClick={() => void handleDelete()}
              >
                <Trash2 className="size-4" />
                Sil
              </Button>
            ) : null}
            <div className="flex w-full justify-end gap-2 sm:w-auto">
              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                Vazgeç
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? <Loader2 className="animate-spin" /> : null}
                {loading ? 'Kaydediliyor...' : editing ? 'Kaydet' : 'Kapalı saat ekle'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
