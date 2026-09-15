import { useState, useEffect, useRef, type FormEvent } from 'react';
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
import { useFocusTrap } from '../hooks/useFocusTrap';
import './AddClientModal.css';

const PENDING_MEET_KEY = 'pendingMeetAppointmentId';

interface UpdateAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  appointment: AppointmentWithClient | null;
}

export const UpdateAppointmentModal = ({
  isOpen,
  onClose,
  onSuccess,
  appointment,
}: UpdateAppointmentModalProps) => {
  const { confirm } = useConfirm();
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(isOpen, dialogRef);
  const getInitialFormData = (apt: AppointmentWithClient) => {
    const dateStr = apt.appointmentDate.includes('T')
      ? apt.appointmentDate.split('T')[0]
      : apt.appointmentDate;
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

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const displayMeetLink = appointment?.googleMeetLink ?? meetLink;

  useEffect(() => {
    if (appointment) {
      setFormData(getInitialFormData(appointment));
      if (!appointment.googleMeetLink) setMeetLink(null);
      setMeetError(null);
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
        const msg =
          err && typeof err === 'object' && 'response' in err
            ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
            : null;
        setMeetError(msg || 'Google Meet oluşturulurken bir hata oluştu.');
      })
      .finally(() => setCreatingMeet(false));
  }, [appointment, onSuccess]);

  if (!isOpen || !appointment) return null;

  const initialFormData = getInitialFormData(appointment);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await updateAppointment(appointment.clientId, appointment.id, {
        appointmentDate: formData.appointmentDate || initialFormData.appointmentDate,
        appointmentTime: formData.appointmentTime || initialFormData.appointmentTime,
        title: formData.title || undefined,
        isPaid: formData.isPaid,
        status: formData.status,
        roomId: formData.roomId,
        durationMinutes: sessionDuration(formData.durationMinutes),
        sessionFee: formData.sessionFee === '' ? undefined : Number(formData.sessionFee),
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
      title: 'Randevuyu sil',
      message: 'Randevu ve notları kalıcı silinsin mi? Gelmedi / iptal için durumu değiştirmen yeterli.',
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
      const status =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { status?: number } }).response?.status
          : null;
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      if (status === 403) {
        setGoogleConnected(false);
      }
      setMeetError(msg || 'Google Meet oluşturulurken bir hata oluştu.');
    } finally {
      setCreatingMeet(false);
    }
  };

  const currentFormData =
    formData.appointmentDate ? formData : initialFormData;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        ref={dialogRef}
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-apt-title"
        tabIndex={-1}
      >
        <div className="modal-header">
          <h2 id="update-apt-title">Randevuyu Güncelle</h2>
          <button className="close-button" onClick={onClose} aria-label="Kapat">
            ×
          </button>
        </div>
        <div style={{ padding: '0 24px 8px', color: 'var(--text-secondary)', fontSize: '14px' }}>
          Danışan: <strong style={{ color: 'var(--text-primary)' }}>{appointment.clientName || 'Danışan'}</strong>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="appointmentDate">Tarih *</label>
            <input
              type="date"
              id="appointmentDate"
              required
              value={currentFormData.appointmentDate}
              onChange={(e) =>
                setFormData({ ...formData, appointmentDate: e.target.value })
              }
            />
          </div>
          <div className="form-group">
            <label htmlFor="appointmentTime">Saat *</label>
            <input
              type="time"
              id="appointmentTime"
              required
              value={currentFormData.appointmentTime}
              onChange={(e) =>
                setFormData({ ...formData, appointmentTime: e.target.value })
              }
            />
          </div>
          <div className="form-group">
            <label htmlFor="durationMinutes">Süre *</label>
            <select
              id="durationMinutes"
              value={currentFormData.durationMinutes}
              onChange={(e) =>
                setFormData({ ...formData, durationMinutes: sessionDuration(Number(e.target.value)) })
              }
            >
              {sessionDurationOptions(currentFormData.durationMinutes).map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="sessionFee">Bu seans ücreti (₺)</label>
            <input
              id="sessionFee"
              type="number"
              min={0}
              placeholder="Anlaşılan ücret"
              value={currentFormData.sessionFee}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  sessionFee: e.target.value === '' ? '' : Number(e.target.value),
                })
              }
            />
          </div>
          <div className="form-group">
            <label htmlFor="title">Başlık</label>
            <input
              type="text"
              id="title"
              placeholder="Opsiyonel"
              value={currentFormData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
            />
          </div>
          {rooms.length > 0 ? (
            <div className="form-group">
              <label htmlFor="updateRoomId">Oda</label>
              <select
                id="updateRoomId"
                value={currentFormData.roomId}
                onChange={(e) => setFormData({ ...formData, roomId: Number(e.target.value) })}
              >
                <option value={0}>Seçilmedi</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="form-group">
            <label htmlFor="appointmentStatus">Durum</label>
            <select
              id="appointmentStatus"
              value={currentFormData.status}
              onChange={(e) =>
                setFormData({ ...formData, status: appointmentStatus(e.target.value) })
              }
            >
              {APPOINTMENT_STATUSES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group form-group-toggle">
            <label>Ödeme Yapıldı mı?</label>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={currentFormData.isPaid}
                onChange={(e) =>
                  setFormData({ ...formData, isPaid: e.target.checked })
                }
              />
              <span className="toggle-slider" />
            </label>
          </div>

          <div className="form-group google-meet-section">
            <label>Google Meet</label>
            {!displayMeetLink ? (
              <>
                <button
                  type="button"
                  className="btn-google-connect"
                  onClick={handleMeetClick}
                  disabled={creatingMeet || connectingGoogle}
                >
                  {connectingGoogle
                    ? 'Google’a yönlendiriliyor...'
                    : creatingMeet
                      ? 'Meet oluşturuluyor...'
                      : 'Google Meet oluştur'}
                </button>
                <p className="meet-hint">
                  Psikolog ve danışan e-postalarına davet gider, ardından toplantı linki burada görünür.
                </p>
              </>
            ) : (
              <div className="meet-links-display">
                <div className="meet-link-box">
                  <a href={displayMeetLink} target="_blank" rel="noopener noreferrer" className="meet-link">
                    Meet linki – yeni sekmede aç
                  </a>
                  <button
                    type="button"
                    className="btn-copy-meet"
                    onClick={async () => {
                      await navigator.clipboard.writeText(displayMeetLink);
                      setCopied(true);
                      window.setTimeout(() => setCopied(false), 2000);
                    }}
                  >
                    {copied ? 'Kopyalandı' : 'Kopyala'}
                  </button>
                </div>
                {appointment.googleHtmlLink && (
                  <a href={appointment.googleHtmlLink} target="_blank" rel="noopener noreferrer" className="calendar-link">
                    Takvimde aç
                  </a>
                )}
              </div>
            )}
            {meetError && <div className="error-message">{meetError}</div>}
          </div>

          {error && <div className="error-message">{error}</div>}
          <div className="modal-actions modal-actions-with-delete">
            <button
              type="button"
              onClick={handleDelete}
              className="btn-danger"
              disabled={deleting}
            >
              {deleting ? 'Siliniyor...' : 'Kalıcı sil'}
            </button>
            <div className="modal-actions-group">
              <button type="button" onClick={onClose} className="btn-secondary">
                İptal
              </button>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Güncelleniyor...' : 'Güncelle'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
