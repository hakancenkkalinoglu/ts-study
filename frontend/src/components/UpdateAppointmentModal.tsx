import { useState, useEffect, type FormEvent } from 'react';
import { Copy, ExternalLink, Loader2, Trash2, Video } from 'lucide-react';
import {
  updateAppointment,
  deleteAppointment,
  getGoogleAuthUrl,
  getGoogleAuthStatus,
  createMeetForAppointment,
  getClinicRooms,
  apiErrorMessage,
} from '../services/api';
import type { AppointmentStatus, AppointmentWithClient, ClinicRoom } from '../types';
import { APPOINTMENT_STATUSES, appointmentStatus, sessionDuration, sessionDurationOptions } from '../types';
import { useConfirm } from '../contexts/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field, FormError, Input, NativeSelect, Switch } from '@/components/ui/input';
import { Avatar } from '@/components/ui/page';

const PENDING_MEET_KEY = 'pendingMeetAppointmentId';

interface UpdateAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  appointment: AppointmentWithClient | null;
}

const getInitialFormData = (apt: AppointmentWithClient) => {
  const dateStr = apt.appointmentDate.includes('T') ? apt.appointmentDate.split('T')[0] : apt.appointmentDate;
  return {
    appointmentDate: dateStr,
    appointmentTime: apt.appointmentTime || '09:00',
    title: apt.title || '',
    isPaid: !!(apt.isPaid ?? 0),
    status: appointmentStatus(apt.status),
    roomId: apt.roomId || 0,
    durationMinutes: sessionDuration(apt.durationMinutes),
    sessionFee: apt.sessionFee ?? ('' as number | ''),
  };
};

const readError = (err: unknown) => {
  const response = err && typeof err === 'object' && 'response' in err
    ? (err as { response?: { status?: number; data?: { message?: string } } }).response
    : undefined;
  return { status: response?.status ?? null, message: response?.data?.message ?? null };
};

export const UpdateAppointmentModal = ({ isOpen, onClose, onSuccess, appointment }: UpdateAppointmentModalProps) => {
  const { confirm } = useConfirm();
  const [formData, setFormData] = useState({
    appointmentDate: '',
    appointmentTime: '09:00',
    title: '',
    isPaid: false,
    status: 'scheduled' as AppointmentStatus,
    roomId: 0,
    durationMinutes: 50,
    sessionFee: '' as number | '',
  });
  const [rooms, setRooms] = useState<ClinicRoom[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [creatingMeet, setCreatingMeet] = useState(false);
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [meetLink, setMeetLink] = useState<string | null>(null);
  const [meetError, setMeetError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const displayMeetLink = appointment?.googleMeetLink ?? meetLink;

  useEffect(() => {
    if (appointment) {
      setFormData(getInitialFormData(appointment));
      if (!appointment.googleMeetLink) setMeetLink(null);
      setMeetError(null);
      setError(null);
    }
  }, [appointment]);

  useEffect(() => {
    if (!isOpen) return;
    getGoogleAuthStatus()
      .then(({ connected }) => setGoogleConnected(connected))
      .catch(() => setGoogleConnected(false));
    getClinicRooms()
      .then(setRooms)
      .catch(() => setRooms([]));
  }, [isOpen]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const google = params.get('google');
    if (google !== 'success' || !appointment) return;
    setGoogleConnected(true);
    window.history.replaceState({}, '', window.location.pathname);
    sessionStorage.removeItem(PENDING_MEET_KEY);
    if (appointment.googleMeetLink) return;
    setCreatingMeet(true);
    createMeetForAppointment(appointment.id, sessionDuration(appointment.durationMinutes))
      .then((result) => {
        setMeetLink(result.meetLink);
        onSuccess();
      })
      .catch((err: unknown) => {
        setMeetError(readError(err).message || 'Google Meet oluşturulurken bir hata oluştu.');
      })
      .finally(() => setCreatingMeet(false));
  }, [appointment, onSuccess]);

  if (!appointment) return null;

  const initialFormData = getInitialFormData(appointment);
  const currentFormData = formData.appointmentDate ? formData : initialFormData;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await updateAppointment(appointment.clientId, appointment.id, {
        appointmentDate: formData.appointmentDate || initialFormData.appointmentDate,
        appointmentTime: formData.appointmentTime || initialFormData.appointmentTime,
        title: formData.title,
        isPaid: formData.isPaid,
        status: formData.status,
        roomId: formData.roomId,
        durationMinutes: sessionDuration(formData.durationMinutes),
        sessionFee: formData.sessionFee === '' ? undefined : Number(formData.sessionFee),
        clearSessionFee: formData.sessionFee === '',
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, 'Randevu güncellenirken bir hata oluştu.'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Randevuyu kalıcı sil',
      message: 'Randevu, notları ve ekleri kalıcı silinsin mi? Gelmedi veya iptal için durumu değiştirmeniz yeterli.',
      confirmLabel: 'Kalıcı sil',
      danger: true,
    });
    if (!ok) return;
    setError(null);
    setDeleting(true);
    try {
      await deleteAppointment(appointment.clientId, appointment.id);
      onSuccess();
      onClose();
    } catch (err) {
      setError('Randevu silinirken bir hata oluştu.');
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  const handleMeetClick = async () => {
    setMeetError(null);
    if (!googleConnected) {
      setConnectingGoogle(true);
      try {
        sessionStorage.setItem(PENDING_MEET_KEY, String(appointment.id));
        const url = await getGoogleAuthUrl();
        window.location.href = url;
      } catch {
        sessionStorage.removeItem(PENDING_MEET_KEY);
        setMeetError('Google bağlantı adresi alınamadı. Hesap sayfasından Google bağlayın.');
        setConnectingGoogle(false);
      }
      return;
    }
    setCreatingMeet(true);
    try {
      const result = await createMeetForAppointment(
        appointment.id,
        sessionDuration(formData.durationMinutes ?? appointment.durationMinutes)
      );
      setMeetLink(result.meetLink);
      onSuccess();
    } catch (err: unknown) {
      const { status, message } = readError(err);
      if (status === 403) {
        setGoogleConnected(false);
      }
      setMeetError(message || 'Google Meet oluşturulurken bir hata oluştu.');
    } finally {
      setCreatingMeet(false);
    }
  };

  const setField = (patch: Partial<typeof formData>) => setFormData((prev) => ({ ...(prev.appointmentDate ? prev : initialFormData), ...patch }));

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent
        title="Randevuyu düzenle"
        description={
          <span className="flex items-center gap-2">
            <Avatar name={appointment.clientName} className="size-5 text-[9px]" />
            {appointment.clientName || 'Danışan'}
          </span>
        }
      >
        <form onSubmit={handleSubmit}>
          <DialogBody>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field label="Tarih *" htmlFor="upd-date" className="col-span-2 sm:col-span-1">
                <Input
                  type="date"
                  id="upd-date"
                  required
                  value={currentFormData.appointmentDate}
                  onChange={(e) => setField({ appointmentDate: e.target.value })}
                />
              </Field>
              <Field label="Saat *" htmlFor="upd-time">
                <Input
                  type="time"
                  id="upd-time"
                  required
                  value={currentFormData.appointmentTime}
                  onChange={(e) => setField({ appointmentTime: e.target.value })}
                />
              </Field>
              <Field label="Süre *" htmlFor="upd-duration">
                <NativeSelect
                  id="upd-duration"
                  value={currentFormData.durationMinutes}
                  onChange={(e) => setField({ durationMinutes: sessionDuration(Number(e.target.value)) })}
                >
                  {sessionDurationOptions(currentFormData.durationMinutes).map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Durum" htmlFor="upd-status">
                <NativeSelect
                  id="upd-status"
                  value={currentFormData.status}
                  onChange={(e) => setField({ status: appointmentStatus(e.target.value) })}
                >
                  {APPOINTMENT_STATUSES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              {rooms.length > 0 ? (
                <Field label="Oda" htmlFor="upd-room">
                  <NativeSelect
                    id="upd-room"
                    value={currentFormData.roomId}
                    onChange={(e) => setField({ roomId: Number(e.target.value) })}
                  >
                    <option value={0}>Seçilmedi</option>
                    {rooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.name}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
              ) : null}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Başlık" htmlFor="upd-title">
                <Input
                  id="upd-title"
                  placeholder="Opsiyonel"
                  value={currentFormData.title}
                  onChange={(e) => setField({ title: e.target.value })}
                />
              </Field>
              <Field label="Bu seansın ücreti (₺)" htmlFor="upd-fee" hint="Boş bırakırsanız anlaşılan ücret kullanılır.">
                <Input
                  id="upd-fee"
                  type="number"
                  min={0}
                  placeholder={appointment.agreedFee != null ? String(appointment.agreedFee) : 'Anlaşılan ücret'}
                  value={currentFormData.sessionFee}
                  onChange={(e) => setField({ sessionFee: e.target.value === '' ? '' : Number(e.target.value) })}
                />
              </Field>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-solid px-4 py-3">
              <div>
                <p className="m-0 text-sm font-medium">Ödeme alındı</p>
                <p className="m-0 text-xs text-muted-foreground">Ödemeler ve raporlar bu işarete göre hesaplanır.</p>
              </div>
              <Switch
                checked={currentFormData.isPaid}
                onCheckedChange={(checked) => setField({ isPaid: checked })}
                aria-label="Ödeme alındı"
              />
            </div>

            <div className="rounded-lg border border-solid bg-muted/40 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <Video className="size-4 text-primary" />
                Google Meet
              </div>
              {!displayMeetLink ? (
                <>
                  <Button type="button" variant="outline" size="sm" onClick={handleMeetClick} disabled={creatingMeet || connectingGoogle}>
                    {creatingMeet || connectingGoogle ? <Loader2 className="animate-spin" /> : <Video />}
                    {connectingGoogle ? 'Google’a yönlendiriliyor...' : creatingMeet ? 'Meet oluşturuluyor...' : 'Meet linki oluştur'}
                  </Button>
                  <p className="m-0 mt-2 text-xs text-muted-foreground">
                    Etkinlik Google Takviminize eklenir. Linki kopyalayıp danışanınıza kendiniz gönderebilirsiniz.
                  </p>
                </>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" size="sm" asChild>
                    <a href={displayMeetLink} target="_blank" rel="noopener noreferrer">
                      <Video />
                      Toplantıya katıl
                    </a>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      await navigator.clipboard.writeText(displayMeetLink);
                      setCopied(true);
                      window.setTimeout(() => setCopied(false), 2000);
                    }}
                  >
                    <Copy />
                    {copied ? 'Kopyalandı' : 'Linki kopyala'}
                  </Button>
                  {appointment.googleHtmlLink ? (
                    <Button type="button" variant="ghost" size="sm" asChild>
                      <a href={appointment.googleHtmlLink} target="_blank" rel="noopener noreferrer">
                        <ExternalLink />
                        Takvimde aç
                      </a>
                    </Button>
                  ) : null}
                </div>
              )}
              {meetError ? <div className="mt-2"><FormError>{meetError}</FormError></div> : null}
            </div>
            <FormError>{error}</FormError>
          </DialogBody>
          <DialogFooter className="sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:bg-destructive/10"
              onClick={handleDelete}
              disabled={deleting}
            >
              <Trash2 />
              {deleting ? 'Siliniyor...' : 'Kalıcı sil'}
            </Button>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={onClose}>
                Vazgeç
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? <Loader2 className="animate-spin" /> : null}
                {loading ? 'Kaydediliyor...' : 'Kaydet'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
