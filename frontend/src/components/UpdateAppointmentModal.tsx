import { useState, useEffect, FormEvent } from 'react';
import { updateAppointment, deleteAppointment } from '../services/api';
import type { AppointmentWithClient } from '../types';
import './AddClientModal.css';

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
    };
  };

  const [formData, setFormData] = useState({
    appointmentDate: '',
    appointmentTime: '09:00',
    title: '',
    isPaid: false,
  });
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (appointment) {
      setFormData(getInitialFormData(appointment));
    }
  }, [appointment]);

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
    if (!window.confirm('Bu randevuyu silmek istediğinize emin misiniz?')) return;
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
          {error && <div className="error-message">{error}</div>}
          <div className="modal-actions modal-actions-with-delete">
            <button
              type="button"
              onClick={handleDelete}
              className="btn-danger"
              disabled={deleting}
            >
              {deleting ? 'Siliniyor...' : 'Sil'}
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
