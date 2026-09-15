import { useState, useEffect, useRef, useCallback, type FormEvent } from 'react';
import { apiErrorMessage, createAppointment, getAppointmentById, getClients, getClinicRooms } from '../services/api';
import type { Client, AppointmentWithClient, ClinicRoom } from '../types';
import { sessionDuration, sessionDurationOptions } from '../types';
import { istanbulTodayYmd } from '../utils/dates';
import { useFocusTrap } from '../hooks/useFocusTrap';
import './AddClientModal.css';
import './AddAppointmentModal.css';

interface AddAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called after create; if createdAppointment is passed, parent should open update modal with it. */
  onSuccess: (createdAppointment?: AppointmentWithClient | null) => void;
  initialDate?: string;
  initialTime?: string;
  initialDuration?: number;
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
  initialTime,
  initialDuration,
}: AddAppointmentModalProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [searching, setSearching] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [formData, setFormData] = useState({
    clientId: 0,
    selectedClientName: '',
    appointmentDate: initialDate || istanbulTodayYmd(),
    appointmentTime: initialTime || '09:00',
    title: '',
    roomId: 0,
    durationMinutes: 50,
  });
  const [rooms, setRooms] = useState<ClinicRoom[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const debouncedSearch = useDebounce(searchTerm, 300);
  useFocusTrap(isOpen, dialogRef);

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
    if (!isOpen) return;
    setFormData((prev) => ({
      ...prev,
      appointmentDate: initialDate || prev.appointmentDate,
      appointmentTime: initialTime || '09:00',
      durationMinutes: sessionDuration(initialDuration ?? 50),
    }));
  }, [isOpen, initialDate, initialTime, initialDuration]);

  const handleSelectClient = (client: Client) => {
    setFormData((prev) => ({
      ...prev,
      clientId: client.id,
      selectedClientName: client.name || client.email || 'İsimsiz',
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
        durationMinutes: sessionDuration(formData.durationMinutes),
      });
      const createdAppointment = await getAppointmentById(result.id);
      setFormData({
        clientId: 0,
        selectedClientName: '',
        appointmentDate: istanbulTodayYmd(),
        appointmentTime: '09:00',
        title: '',
        roomId: 0,
        durationMinutes: 50,
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
      <div
        ref={dialogRef}
        className="modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-apt-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="add-apt-title">Yeni Randevu Ekle</h2>
          <button className="close-button" onClick={onClose} aria-label="Kapat">
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
                            {c.name || c.email || 'İsimsiz'}
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
          <div className="form-group">
            <label htmlFor="durationMinutes">Süre *</label>
            <select
              id="durationMinutes"
              value={formData.durationMinutes}
              onChange={(e) =>
                setFormData({ ...formData, durationMinutes: sessionDuration(Number(e.target.value)) })
              }
            >
              {sessionDurationOptions(formData.durationMinutes).map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
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
