import { useState, useEffect, type FormEvent } from 'react';
import {
  updateAppointment,
  deleteAppointment,
  getGoogleAuthUrl,
  getGoogleAuthStatus,
  createMeetForAppointment,
} from '../services/api';
import type { AppointmentStatus, AppointmentWithClient } from '../types';
import { APPOINTMENT_STATUSES, appointmentStatus } from '../types';
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
    };
  };

  const [formData, setFormData] = useState({
    appointmentDate: '',
    appointmentTime: '09:00',
    title: '',
    isPaid: false,
    status: 'scheduled' as AppointmentStatus,
  });
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [creatingMeet, setCreatingMeet] = useState(false);
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [meetLink, setMeetLink] = useState<string | null>(null);
  const [meetError, setMeetError] = useState<string | null>(null);

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
    createMeetForAppointment(appointment.id, 60)
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
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError('Randevu güncellenirken bir hata oluştu.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Randevu ve notları kalıcı silinsin mi? Gelmedi / iptal için durumu değiştirmen yeterli.')) return;
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
    if (!appointment.clientEmail) {
      setMeetError('Danışanın e-posta adresi yok. Önce danışan kaydına e-posta ekleyin.');
      return;
    }
    if (!googleConnected) {
      setConnectingGoogle(true);
      try {
        sessionStorage.setItem(PENDING_MEET_KEY, String(appointment.id));
        const url = await getGoogleAuthUrl();
        window.location.href = url;
      } catch {
        sessionStorage.removeItem(PENDING_MEET_KEY);
        setMeetError('Google bağlantı adresi alınamadı. GOOGLE_CLIENT_ID ayarlı mı?');
        setConnectingGoogle(false);
      }
      return;
    }
    setCreatingMeet(true);
    try {
      const result = await createMeetForAppointment(appointment.id, 60);
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
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Randevuyu Güncelle</h2>
          <button className="close-button" onClick={onClose}>
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
                    onClick={() => navigator.clipboard.writeText(displayMeetLink)}
                  >
                    Kopyala
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
