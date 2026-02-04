import { useState, FormEvent } from 'react';
import { createClient } from '../services/api';
import './AddClientModal.css';

interface AddClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddClientModal = ({ isOpen, onClose, onSuccess }: AddClientModalProps) => {
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    birthDate: '',
    agreedFee: 2000,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await createClient({
        email: formData.email,
        name: formData.name || undefined,
        birthDate: formData.birthDate || undefined,
        agreedFee: formData.agreedFee,
      });
      onSuccess();
      setFormData({ email: '', name: '', birthDate: '', agreedFee: 2000 });
      onClose();
    } catch (err) {
      setError('Danışan eklenirken bir hata oluştu.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Yeni Danışan Ekle</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">E-posta *</label>
            <input
              type="email"
              id="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label htmlFor="name">Ad Soyad</label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
