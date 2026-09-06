import { useState, useEffect, useRef, useCallback, FormEvent } from 'react';
import { apiErrorMessage, createAppointment, getAppointmentById, getClients, getClinicRooms } from '../services/api';
import type { Client, AppointmentWithClient, ClinicRoom } from '../types';
import './AddClientModal.css';
import './AddAppointmentModal.css';

interface AddAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called after create; if createdAppointment is passed, parent should open update modal with it. */
  onSuccess: (createdAppointment?: AppointmentWithClient | null) => void;
  initialDate?: string;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

export const AddAppointmentModal = ({
  isOpen,
  onClose,
  onSuccess,
  initialDate,
}: AddAppointmentModalProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [searching, setSearching] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [formData, setFormData] = useState({
    clientId: 0,
    selectedClientName: '',
    appointmentDate: initialDate || new Date().toISOString().split('T')[0],
    appointmentTime: '09:00',
    title: '',
    roomId: 0,
  });
  const [rooms, setRooms] = useState<ClinicRoom[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debouncedSearch = useDebounce(searchTerm, 300);

  const fetchClients = useCallback(async (term: string) => {
    setSearching(true);
    try {
      const data = await getClients(term.trim() || undefined);
      setClients(data);
    } catch {
      setClients([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (!dropdownOpen) return;
    if (debouncedSearch.trim().length >= 2) {
      fetchClients(debouncedSearch);
    } else {
      setClients([]);
    }
  }, [debouncedSearch, dropdownOpen, fetchClients]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setDropdownOpen(false);
      setClients([]);
      getClinicRooms()
        .then(setRooms)
        .catch(() => setRooms([]));
    }
  }, [isOpen]);

  useEffect(() => {
    if (initialDate) {
      setFormData((prev) => ({ ...prev, appointmentDate: initialDate }));
    }
  }, [initialDate]);

  const handleSelectClient = (client: Client) => {
    setFormData((prev) => ({
      ...prev,
      clientId: client.id,
      selectedClientName: client.name || client.email,
    }));
    setSearchTerm('');
    setDropdownOpen(false);
  };

  const handleClearClient = () => {
    setFormData((prev) => ({
      ...prev,
      clientId: 0,
      selectedClientName: '',
    }));
    setSearchTerm('');
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!formData.clientId) {
      setError('Lütfen bir danışan seçin.');
      return;
    }
    setLoading(true);

    try {
      const result = await createAppointment({
        clientId: formData.clientId,
        appointmentDate: formData.appointmentDate,
        appointmentTime: formData.appointmentTime,
        title: formData.title || undefined,
        roomId: formData.roomId || undefined,
      });
      const createdAppointment = await getAppointmentById(result.id);
      setFormData({
        clientId: 0,
        selectedClientName: '',
        appointmentDate: new Date().toISOString().split('T')[0],
        appointmentTime: '09:00',
        title: '',
        roomId: 0,
      });
      setSearchTerm('');
      onSuccess(createdAppointment);
    } catch (err) {
      setError(apiErrorMessage(err, 'Randevu eklenirken bir hata oluştu.'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Yeni Randevu Ekle</h2>
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group" ref={dropdownRef}>
            <label htmlFor="client-search">Danışan *</label>
            <div className="client-combobox">
              {formData.clientId ? (
                <div className="client-selected">
                  <span>{formData.selectedClientName}</span>
                  <button
                    type="button"
                    className="client-clear-btn"
                    onClick={handleClearClient}
                    title="Değiştir"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <>
                  <input
                    id="client-search"
                    type="text"
                    placeholder="Ad veya e-posta ile ara..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setDropdownOpen(true);
                    }}
                    onFocus={() => setDropdownOpen(true)}
                    autoComplete="off"
                    className="form-select client-search-input"
                  />
                  {dropdownOpen && (
                    <div className="client-dropdown">
                      {searching ? (
                        <div className="client-dropdown-loading">Aranıyor...</div>
                      ) : clients.length === 0 ? (
                        <div className="client-dropdown-empty">
                          {searchTerm.trim().length < 2
                            ? 'En az 2 karakter yazın'
                            : 'Sonuç bulunamadı'}
                        </div>
                      ) : (
                        clients.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            className="client-dropdown-item"
                            onClick={() => handleSelectClient(c)}
                          >
                            {c.name || c.email}
                            {c.email && c.name && (
                              <span className="client-email">{c.email}</span>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="appointmentDate">Tarih *</label>
            <input
              type="date"
              id="appointmentDate"
              required
              value={formData.appointmentDate}
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
              value={formData.appointmentTime}
              onChange={(e) =>
                setFormData({ ...formData, appointmentTime: e.target.value })
              }
            />
          </div>
          {rooms.length > 0 ? (
            <div className="form-group">
              <label htmlFor="roomId">Oda</label>
              <select
                id="roomId"
                value={formData.roomId}
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
            <label htmlFor="title">Başlık</label>
            <input
              type="text"
              id="title"
              placeholder="Opsiyonel"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
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
