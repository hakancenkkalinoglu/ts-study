import { useEffect, useRef, useState, type FormEvent } from 'react';
import { apiErrorMessage, createClient } from '../services/api';
import { useFocusTrap } from '../hooks/useFocusTrap';
import './AddClientModal.css';

interface AddClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddClientModal = ({ isOpen, onClose, onSuccess }: AddClientModalProps) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(isOpen, dialogRef);
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    birthDate: '',
    agreedFee: 2000,
    phone: '',
    emergencyName: '',
    emergencyPhone: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!formData.name.trim()) {
      setError('Ad soyad zorunludur.');
      return;
    }
    setLoading(true);

    try {
      await createClient({
        name: formData.name.trim(),
        email: formData.email.trim() || undefined,
        birthDate: formData.birthDate || undefined,
        agreedFee: formData.agreedFee,
        phone: formData.phone.trim() || undefined,
        emergencyName: formData.emergencyName.trim() || undefined,
        emergencyPhone: formData.emergencyPhone.trim() || undefined,
      });
      onSuccess();
      setFormData({
        email: '',
        name: '',
        birthDate: '',
        agreedFee: 2000,
        phone: '',
        emergencyName: '',
        emergencyPhone: '',
      });
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, 'Danışan eklenirken bir hata oluştu.'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        ref={dialogRef}
        className="modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-client-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="add-client-title">Yeni Danışan Ekle</h2>
          <button className="close-button" onClick={onClose} aria-label="Kapat">×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Ad Soyad *</label>
            <input
              type="text"
              id="name"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label htmlFor="email">E-posta</label>
            <input
              type="email"
              id="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label htmlFor="birthDate">Doğum Tarihi</label>
            <input
              type="date"
              id="birthDate"
              value={formData.birthDate}
              onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label htmlFor="phone">Telefon</label>
            <input
              type="tel"
              id="phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="05xx xxx xx xx"
            />
          </div>
          <div className="form-group">
            <label htmlFor="emergencyName">Acil kişi</label>
            <input
              type="text"
              id="emergencyName"
              value={formData.emergencyName}
              onChange={(e) => setFormData({ ...formData, emergencyName: e.target.value })}
              placeholder="Ad soyad"
            />
          </div>
          <div className="form-group">
            <label htmlFor="emergencyPhone">Acil kişi telefonu</label>
            <input
              type="tel"
              id="emergencyPhone"
              value={formData.emergencyPhone}
              onChange={(e) => setFormData({ ...formData, emergencyPhone: e.target.value })}
              placeholder="05xx xxx xx xx"
            />
          </div>
          <div className="form-group">
            <label htmlFor="agreedFee">Anlaşılan Ücret (₺)</label>
            <input
              type="number"
              id="agreedFee"
              min={0}
              step={100}
              value={formData.agreedFee}
              onChange={(e) => setFormData({ ...formData, agreedFee: Number(e.target.value) || 0 })}
            />
          </div>
          {error && <div className="error-message">{error}</div>}
          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn-secondary">
              İptal
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Ekleniyor...' : 'Ekle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
