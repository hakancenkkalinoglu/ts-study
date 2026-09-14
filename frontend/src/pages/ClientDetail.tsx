import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getClient,
  getClientNotes,
  getAppointments,
  createAppointment,
  createAppointmentNote,
  createNote,
  updateNote,
  deleteNote,
  updateAppointment,
  updateClient,
  getClinicRooms,
  attachNoteFile,
  deleteNoteFile,
  downloadNoteFile,
  apiErrorMessage,
} from '../services/api';
import type { Appointment, AppointmentStatus, Client, ClinicRoom, Note } from '../types';
import {
  APPOINTMENT_STATUSES,
  appointmentStatus,
  appointmentStatusLabel,
  REPEAT_COUNTS,
  SESSION_DURATIONS,
  sessionDuration,
  sessionDurationLabel,
} from '../types';
import { SessionPackages } from '../components/SessionPackages';
import { ClientInventories } from '../components/ClientInventories';
import { istanbulTodayYmd } from '../utils/dates';
import './ClientDetail.css';

const toDateInputValue = (value: string | null | undefined): string => {
  if (!value) return '';
  return value.includes('T') ? value.split('T')[0] : value.slice(0, 10);
};

const emptyAppointmentForm = () => ({
  appointmentDate: istanbulTodayYmd(),
  appointmentTime: '09:00',
  title: '',
  isPaid: false,
  status: 'scheduled' as AppointmentStatus,
  roomId: 0,
  durationMinutes: 50,
  repeatCount: 1,
  sessionFee: '' as number | '',
});

const emptyClientForm = () => ({
  name: '',
  email: '',
  birthDate: '',
  agreedFee: 0,
  phone: '',
  emergencyName: '',
  emergencyPhone: '',
});

export const ClientDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [notesByAppointment, setNotesByAppointment] = useState<Record<number, Note[]>>({});
  const [allNotes, setAllNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAppointmentForm, setShowAppointmentForm] = useState(false);
  const [showAllNotesModal, setShowAllNotesModal] = useState(false);
  const [expandedAppointments, setExpandedAppointments] = useState<Set<number>>(new Set());
  const [showNoteFormFor, setShowNoteFormFor] = useState<number | null>(null);
  const [editingAppointmentId, setEditingAppointmentId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editingClient, setEditingClient] = useState(false);
  const [clientForm, setClientForm] = useState(emptyClientForm());
  const [savingClient, setSavingClient] = useState(false);
  const [clientFormError, setClientFormError] = useState<string | null>(null);

  const [appointmentForm, setAppointmentForm] = useState(emptyAppointmentForm);
  const [rooms, setRooms] = useState<ClinicRoom[]>([]);
  const [noteForm, setNoteForm] = useState({
    title: '',
    content: '',
    noteDate: istanbulTodayYmd(),
  });
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [noteSearch, setNoteSearch] = useState('');

  const fillClientForm = (foundClient: Client) => {
    setClientForm({
      name: foundClient.name || '',
      email: foundClient.email || '',
      birthDate: toDateInputValue(foundClient.birthDate),
      agreedFee: foundClient.agreedFee ?? 0,
      phone: foundClient.phone || '',
      emergencyName: foundClient.emergencyName || '',
      emergencyPhone: foundClient.emergencyPhone || '',
    });
  };

  const loadClientData = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const foundClient = await getClient(Number(id));
      setClient(foundClient);
      fillClientForm(foundClient);
      const [appointmentsData, notesData] = await Promise.all([
        getAppointments(foundClient.id),
        getClientNotes(foundClient.id),
      ]);
        setAppointments(appointmentsData);
        setAllNotes(notesData);
        const notesMap: Record<number, Note[]> = {};
        for (const note of notesData) {
          if (note.appointmentId == null) continue;
          notesMap[note.appointmentId] = [...(notesMap[note.appointmentId] || []), note];
        }
        setNotesByAppointment(notesMap);
    } catch (error) {
      console.error('Error loading client data:', error);
      setClient(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) loadClientData();
  }, [id, loadClientData]);

  useEffect(() => {
    getClinicRooms()
      .then(setRooms)
      .catch(() => setRooms([]));
  }, []);

  const handleAddAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client) return;

    try {
      setSubmitting(true);
      await createAppointment({
        clientId: client.id,
        appointmentDate: appointmentForm.appointmentDate,
        appointmentTime: appointmentForm.appointmentTime,
        title: appointmentForm.title || undefined,
        isPaid: appointmentForm.isPaid,
        roomId: appointmentForm.roomId || undefined,
        durationMinutes: sessionDuration(appointmentForm.durationMinutes),
        repeatCount: appointmentForm.repeatCount,
        sessionFee: appointmentForm.sessionFee === '' ? undefined : Number(appointmentForm.sessionFee),
      });
      setAppointmentForm(emptyAppointmentForm());
      setShowAppointmentForm(false);
      loadClientData();
    } catch (error: unknown) {
      console.error('Error adding appointment:', error);
      alert(apiErrorMessage(error, 'Randevu eklenirken bir hata oluştu.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateAppointment = async (appointmentId: number, e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!client) return;

    try {
      setSubmitting(true);
      await updateAppointment(client.id, appointmentId, {
        appointmentDate: appointmentForm.appointmentDate,
        appointmentTime: appointmentForm.appointmentTime,
        title: appointmentForm.title || undefined,
        isPaid: appointmentForm.isPaid,
        status: appointmentForm.status,
        roomId: appointmentForm.roomId,
        durationMinutes: sessionDuration(appointmentForm.durationMinutes),
        sessionFee: appointmentForm.sessionFee === '' ? undefined : Number(appointmentForm.sessionFee),
      });
      setEditingAppointmentId(null);
      setAppointmentForm(emptyAppointmentForm());
      loadClientData();
    } catch (error: unknown) {
      console.error('Error updating appointment:', error);
      const message = error && typeof error === 'object' && 'response' in error
        ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
        : null;
      alert(message || 'Randevu güncellenirken bir hata oluştu.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAppointment = async (appointmentId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!client) return;
    if (!window.confirm('Randevu iptal edilsin mi? Kayıt ve notlar durur, saat boşalır.')) return;

    try {
      await updateAppointment(client.id, appointmentId, { status: 'cancelled' });
      setEditingAppointmentId(null);
      loadClientData();
    } catch (error) {
      console.error('Error cancelling appointment:', error);
      alert('Randevu iptal edilirken bir hata oluştu.');
    }
  };

  const startEditAppointment = (apt: Appointment, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedAppointments((prev) => new Set(prev).add(apt.id));
    setEditingAppointmentId(apt.id);
    const dateStr = apt.appointmentDate.includes('T') ? apt.appointmentDate.split('T')[0] : apt.appointmentDate;
    setAppointmentForm({
      appointmentDate: dateStr,
      appointmentTime: apt.appointmentTime || '09:00',
      title: apt.title || '',
      isPaid: !!(apt.isPaid ?? 0),
      status: appointmentStatus(apt.status),
      roomId: apt.roomId || 0,
      durationMinutes: sessionDuration(apt.durationMinutes),
      repeatCount: 1,
      sessionFee: apt.sessionFee ?? '',
    });
  };

  const handleAddNoteToAppointment = async (appointmentId: number, e: React.FormEvent) => {
    e.preventDefault();
    if (!client || !noteForm.content) return;

    try {
      setSubmitting(true);
      await createAppointmentNote(client.id, appointmentId, {
        title: noteForm.title || undefined,
        content: noteForm.content,
        noteDate: noteForm.noteDate,
      });
      resetNoteForm();
      loadClientData();
    } catch (error) {
      console.error('Error adding note:', error);
      alert('Not eklenirken bir hata oluştu.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddStandaloneNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client || !noteForm.content.trim()) return;
    try {
      setSubmitting(true);
      await createNote({
        clientId: client.id,
        title: noteForm.title || undefined,
        content: noteForm.content.trim(),
        noteDate: noteForm.noteDate,
      });
      resetNoteForm();
      loadClientData();
    } catch (error) {
      alert(apiErrorMessage(error, 'Not eklenirken bir hata oluştu.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleNoteFile = async (noteId: number, file: File) => {
    if (!client) return;
    try {
      await attachNoteFile(client.id, noteId, file);
      loadClientData();
    } catch (error) {
      alert(apiErrorMessage(error, 'Ek yüklenemedi.'));
    }
  };

  const resetNoteForm = () => {
    setNoteForm({ title: '', content: '', noteDate: istanbulTodayYmd() });
    setEditingNoteId(null);
    setShowNoteFormFor(null);
  };

  const startEditNote = (note: Note) => {
    const dateStr = note.noteDate.includes('T') ? note.noteDate.split('T')[0] : note.noteDate.slice(0, 10);
    setEditingNoteId(note.id);
    setShowNoteFormFor(null);
    setNoteForm({
      title: note.title || '',
      content: note.content,
      noteDate: dateStr,
    });
  };

  const handleUpdateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!client || editingNoteId == null || !noteForm.content.trim()) return;
    try {
      setSubmitting(true);
      await updateNote(client.id, editingNoteId, {
        title: noteForm.title,
        content: noteForm.content.trim(),
        noteDate: noteForm.noteDate,
      });
      resetNoteForm();
      loadClientData();
    } catch (error) {
      console.error('Error updating note:', error);
      alert(apiErrorMessage(error, 'Not güncellenemedi.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteNote = async (noteId: number) => {
    if (!client) return;
    if (!window.confirm('Bu not silinsin mi? Bu işlem geri alınamaz.')) return;
    try {
      await deleteNote(client.id, noteId);
      if (editingNoteId === noteId) {
        resetNoteForm();
      }
      loadClientData();
    } catch (error) {
      console.error('Error deleting note:', error);
      alert(apiErrorMessage(error, 'Not silinemedi.'));
    }
  };

  const toggleAppointmentExpand = (aptId: number) => {
    setExpandedAppointments((prev) => {
      const next = new Set(prev);
      if (next.has(aptId)) next.delete(aptId);
      else next.add(aptId);
      return next;
    });
  };

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client) return;
    const name = clientForm.name.trim();
    if (!name) {
      setClientFormError('Ad soyad zorunludur.');
      return;
    }
    try {
      setSavingClient(true);
      setClientFormError(null);
      await updateClient(client.id, {
        name,
        email: clientForm.email.trim(),
        birthDate: clientForm.birthDate,
        agreedFee: clientForm.agreedFee,
        phone: clientForm.phone,
        emergencyName: clientForm.emergencyName,
        emergencyPhone: clientForm.emergencyPhone,
      });
      setEditingClient(false);
      loadClientData();
    } catch (error) {
      console.error('Error updating client:', error);
      setClientFormError(apiErrorMessage(error, 'Danışan bilgileri kaydedilemedi.'));
    } finally {
      setSavingClient(false);
    }
  };

  const noteMatchesSearch = (note: Note) => {
    const query = noteSearch.trim().toLocaleLowerCase('tr-TR');
    if (!query) return true;
    const title = (note.title || '').toLocaleLowerCase('tr-TR');
    const content = (note.content || '').toLocaleLowerCase('tr-TR');
    return title.includes(query) || content.includes(query);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const renderNoteCard = (note: Note) => {
    if (editingNoteId === note.id) {
      return (
        <form key={note.id} className="note-form" onSubmit={handleUpdateNote}>
          <div className="form-group">
            <label>Başlık (opsiyonel)</label>
            <input
              type="text"
              value={noteForm.title}
              onChange={(e) => setNoteForm({ ...noteForm, title: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>İçerik *</label>
            <textarea
              value={noteForm.content}
              onChange={(e) => setNoteForm({ ...noteForm, content: e.target.value })}
              rows={4}
              required
            />
          </div>
          <div className="form-group">
            <label>Tarih</label>
            <input
              type="date"
              value={noteForm.noteDate}
              onChange={(e) => setNoteForm({ ...noteForm, noteDate: e.target.value })}
              required
            />
          </div>
          <div className="form-actions-inline">
            <button type="submit" className="submit-button" disabled={submitting}>
              {submitting ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
            <button type="button" className="cancel-button" onClick={resetNoteForm}>
              Vazgeç
            </button>
          </div>
        </form>
      );
    }
    return (
      <div key={note.id} className="note-card">
        <div className="note-header">
          <h3>{note.title || 'Başlıksız Not'}</h3>
          <span className="note-date">{formatDate(note.noteDate)}</span>
        </div>
        <p className="note-content">{note.content}</p>
        {note.fileName ? (
          <p>
            Ek:{' '}
            <button type="button" className="clinic-link" onClick={() => client && downloadNoteFile(client.id, note.id, note.fileName)}>
              {note.fileName}
            </button>
            <button
              type="button"
              className="clinic-link"
              onClick={() => client && deleteNoteFile(client.id, note.id).then(() => loadClientData())}
            >
              Eki sil
            </button>
          </p>
        ) : (
          <label className="clinic-link">
            Ek yükle
            <input
              type="file"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleNoteFile(note.id, file);
              }}
            />
          </label>
        )}
        <div className="note-footer note-footer-actions">
          <span className="note-created">Oluşturulma: {formatDate(note.createdAt)}</span>
          <div className="note-actions">
            <button type="button" className="edit-apt-button" onClick={() => startEditNote(note)}>
              Düzenle
            </button>
            <button type="button" className="delete-apt-button" onClick={() => handleDeleteNote(note.id)}>
              Sil
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="client-detail-container">
        <div className="loading">Yükleniyor...</div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="client-detail-container">
        <div className="error-state">
          <p>Danışan bulunamadı.</p>
          <button onClick={() => navigate('/danisanlar')} className="back-button">
            Geri Dön
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="client-detail-container">
      <button onClick={() => navigate('/danisanlar')} className="back-button">
        ← Geri Dön
      </button>

      <div className="client-info-card">
        <div className="client-info-head">
          <h1>{client.name || 'İsimsiz Danışan'}</h1>
          {!editingClient ? (
            <button
              type="button"
              className="edit-apt-button"
              onClick={() => {
                fillClientForm(client);
                setClientFormError(null);
                setEditingClient(true);
              }}
            >
              Düzenle
            </button>
          ) : null}
        </div>
        {editingClient ? (
          <form className="note-form" onSubmit={handleSaveClient}>
            <div className="form-group">
              <label htmlFor="client-name">Ad Soyad *</label>
              <input
                id="client-name"
                type="text"
                required
                value={clientForm.name}
                onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label htmlFor="client-email">E-posta</label>
              <input
                id="client-email"
                type="email"
                value={clientForm.email}
                onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label htmlFor="client-birthDate">Doğum Tarihi</label>
              <input
                id="client-birthDate"
                type="date"
                value={clientForm.birthDate}
                onChange={(e) => setClientForm({ ...clientForm, birthDate: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label htmlFor="client-agreedFee">Anlaşılan Ücret (₺)</label>
              <input
                id="client-agreedFee"
                type="number"
                min={0}
                step={100}
                value={clientForm.agreedFee}
                onChange={(e) =>
                  setClientForm({ ...clientForm, agreedFee: Number(e.target.value) || 0 })
                }
              />
            </div>
            <div className="form-group">
              <label htmlFor="client-phone">Telefon</label>
              <input
                id="client-phone"
                type="tel"
                value={clientForm.phone}
                onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label htmlFor="client-emergencyName">Acil kişi</label>
              <input
                id="client-emergencyName"
                type="text"
                value={clientForm.emergencyName}
                onChange={(e) => setClientForm({ ...clientForm, emergencyName: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label htmlFor="client-emergencyPhone">Acil kişi telefonu</label>
              <input
                id="client-emergencyPhone"
                type="tel"
                value={clientForm.emergencyPhone}
                onChange={(e) =>
                  setClientForm({ ...clientForm, emergencyPhone: e.target.value })
                }
              />
            </div>
            {clientFormError ? <div className="error-message">{clientFormError}</div> : null}
            <div className="form-actions-inline">
              <button type="submit" className="submit-button" disabled={savingClient}>
                {savingClient ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
              <button
                type="button"
                className="cancel-button"
                onClick={() => {
                  setEditingClient(false);
                  setClientFormError(null);
                  fillClientForm(client);
                }}
              >
                Vazgeç
              </button>
            </div>
          </form>
        ) : (
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">E-posta:</span>
              <span className="info-value">{client.email || '-'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Telefon:</span>
              <span className="info-value">
                {client.phone ? (
                  <a href={`tel:${client.phone}`}>{client.phone}</a>
                ) : (
                  '-'
                )}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">Acil kişi:</span>
              <span className="info-value">{client.emergencyName || '-'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Acil telefon:</span>
              <span className="info-value">
                {client.emergencyPhone ? (
                  <a href={`tel:${client.emergencyPhone}`}>{client.emergencyPhone}</a>
                ) : (
                  '-'
                )}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">Doğum Tarihi:</span>
              <span className="info-value">{formatDate(client.birthDate)}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Anlaşılan Ücret:</span>
              <span className="info-value">
                {client.agreedFee != null ? `${client.agreedFee.toLocaleString('tr-TR')} ₺` : '-'}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">Kayıt Tarihi:</span>
              <span className="info-value">{formatDate(client.createdAt)}</span>
            </div>
          </div>
        )}
      </div>

      <SessionPackages clientId={client.id} />
      <ClientInventories clientId={client.id} />

      <div className="client-info-card">
        <h2>Randevusuz not</h2>
        <form className="note-form" onSubmit={handleAddStandaloneNote}>
          <div className="form-group">
            <label htmlFor="loose-title">Başlık</label>
            <input
              id="loose-title"
              value={noteForm.title}
              onChange={(e) => setNoteForm({ ...noteForm, title: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label htmlFor="loose-content">İçerik *</label>
            <textarea
              id="loose-content"
              value={noteForm.content}
              onChange={(e) => setNoteForm({ ...noteForm, content: e.target.value })}
              rows={3}
              required
            />
          </div>
          <button type="submit" className="submit-button" disabled={submitting}>
            Not kaydet
          </button>
        </form>
        {allNotes.filter((note) => note.appointmentId == null).map((note) => renderNoteCard(note))}
      </div>

      <div className="appointments-section">
        <div className="section-header">
          <h2>Randevular</h2>
          <div className="section-actions">
            <input
              type="search"
              className="note-search-input"
              placeholder="Notlarda ara..."
              value={noteSearch}
              onChange={(e) => setNoteSearch(e.target.value)}
            />
            <button
              className="all-notes-button"
              onClick={() => setShowAllNotesModal(true)}
              title="Danışanın tüm notlarını görüntüle"
            >
              Tüm Notları Gör
            </button>
            <button
              className="add-note-button"
              onClick={() => setShowAppointmentForm(!showAppointmentForm)}
            >
              {showAppointmentForm ? 'İptal' : '+ Randevu Ekle'}
            </button>
          </div>
        </div>

        {showAppointmentForm && (
          <form className="note-form appointment-form" onSubmit={handleAddAppointment}>
            <div className="form-group">
              <label>Randevu Tarihi *</label>
              <input
                type="date"
                value={appointmentForm.appointmentDate}
                onChange={(e) =>
                  setAppointmentForm({ ...appointmentForm, appointmentDate: e.target.value })
                }
                required
              />
            </div>
            <div className="form-group">
              <label>Randevu Saati *</label>
              <input
                type="time"
                value={appointmentForm.appointmentTime}
                onChange={(e) =>
                  setAppointmentForm({ ...appointmentForm, appointmentTime: e.target.value })
                }
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="newDurationMinutes">Süre *</label>
              <select
                id="newDurationMinutes"
                value={appointmentForm.durationMinutes}
                onChange={(e) =>
                  setAppointmentForm({
                    ...appointmentForm,
                    durationMinutes: sessionDuration(Number(e.target.value)),
                  })
                }
              >
                {SESSION_DURATIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="newSessionFee">Bu seans ücreti (₺)</label>
              <input
                id="newSessionFee"
                type="number"
                min={0}
                placeholder="Anlaşılan ücret"
                value={appointmentForm.sessionFee}
                onChange={(e) =>
                  setAppointmentForm({
                    ...appointmentForm,
                    sessionFee: e.target.value === '' ? '' : Number(e.target.value),
                  })
                }
              />
            </div>
            <div className="form-group">
              <label htmlFor="newRepeatCount">Tekrar</label>
              <select
                id="newRepeatCount"
                value={appointmentForm.repeatCount}
                onChange={(e) =>
                  setAppointmentForm({ ...appointmentForm, repeatCount: Number(e.target.value) })
                }
              >
                {REPEAT_COUNTS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              {appointmentForm.repeatCount > 1 ? (
                <p className="empty-hint">Aynı gün ve saatte haftalık seanslar açılır. Bir seans çakışırsa hiçbiri kaydedilmez.</p>
              ) : null}
            </div>
            {rooms.length > 0 ? (
              <div className="form-group">
                <label>Oda</label>
                <select
                  value={appointmentForm.roomId}
                  onChange={(e) =>
                    setAppointmentForm({ ...appointmentForm, roomId: Number(e.target.value) })
                  }
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
              <label>Başlık (opsiyonel)</label>
              <input
                type="text"
                value={appointmentForm.title}
                onChange={(e) => setAppointmentForm({ ...appointmentForm, title: e.target.value })}
                placeholder="Örn: İlk görüşme"
              />
            </div>
            <div className="form-group form-group-toggle">
              <label>Ödeme Yapıldı mı?</label>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={appointmentForm.isPaid}
                  onChange={(e) =>
                    setAppointmentForm({ ...appointmentForm, isPaid: e.target.checked })
                  }
                />
                <span className="toggle-slider" />
              </label>
            </div>
            <button type="submit" className="submit-button" disabled={submitting}>
              {submitting
                ? 'Ekleniyor...'
                : appointmentForm.repeatCount > 1
                  ? `${appointmentForm.repeatCount} seans ekle`
                  : 'Randevu Ekle'}
            </button>
          </form>
        )}

        {appointments.length === 0 ? (
          <div className="empty-notes">
            <p>Henüz randevu eklenmemiş.</p>
            <p className="empty-hint">Randevu ekledikten sonra her randevuya not ekleyebilirsiniz.</p>
          </div>
        ) : (
          <div className="appointments-list">
            {appointments.map((apt) => (
              <div key={apt.id} className="appointment-card">
                <div
                  className="appointment-header"
                  onClick={() => toggleAppointmentExpand(apt.id)}
                >
                  <div className="appointment-info">
                    <span className="appointment-date">{formatDate(apt.appointmentDate)}</span>
                    {apt.appointmentTime && (
                      <span className="appointment-time">
                        {apt.appointmentTime} · {sessionDurationLabel(apt.durationMinutes)}
                      </span>
                    )}
                    {apt.title && <span className="appointment-title">— {apt.title}</span>}
                    {apt.roomName ? <span className="appointment-title">· {apt.roomName}</span> : null}
                    <span className={`appointment-status-badge status-${appointmentStatus(apt.status)}`}>
                      {appointmentStatusLabel(apt.status)}
                    </span>
                    <span className={`appointment-paid-badge ${(apt.isPaid ?? 0) ? 'paid' : 'unpaid'}`}>
                      {(apt.isPaid ?? 0) ? 'Ödeme Yapıldı' : 'Ödeme Bekliyor'}
                    </span>
                  </div>
                  <div className="appointment-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="edit-apt-button"
                      onClick={(e) => startEditAppointment(apt, e)}
                      title="Düzenle"
                    >
                      Düzenle
                    </button>
                    <button
                      type="button"
                      className="delete-apt-button"
                      onClick={(e) => handleDeleteAppointment(apt.id, e)}
                      title="İptal et"
                    >
                      İptal et
                    </button>
                    <span className="expand-icon">{expandedAppointments.has(apt.id) ? '▼' : '▶'}</span>
                  </div>
                </div>

                {expandedAppointments.has(apt.id) && (
                  <div className="appointment-notes">
                    {editingAppointmentId === apt.id ? (
                      <form
                        className="note-form inline-note-form"
                        onSubmit={(e) => handleUpdateAppointment(apt.id, e)}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="form-group">
                          <label>Randevu Tarihi *</label>
                          <input
                            type="date"
                            value={appointmentForm.appointmentDate}
                            onChange={(e) =>
                              setAppointmentForm({ ...appointmentForm, appointmentDate: e.target.value })
                            }
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label>Randevu Saati *</label>
                          <input
                            type="time"
                            value={appointmentForm.appointmentTime}
                            onChange={(e) =>
                              setAppointmentForm({ ...appointmentForm, appointmentTime: e.target.value })
                            }
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label htmlFor={`editDuration-${apt.id}`}>Süre *</label>
                          <select
                            id={`editDuration-${apt.id}`}
                            value={appointmentForm.durationMinutes}
                            onChange={(e) =>
                              setAppointmentForm({
                                ...appointmentForm,
                                durationMinutes: sessionDuration(Number(e.target.value)),
                              })
                            }
                          >
                            {SESSION_DURATIONS.map((item) => (
                              <option key={item.value} value={item.value}>
                                {item.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group">
                          <label htmlFor={`editFee-${apt.id}`}>Bu seans ücreti (₺)</label>
                          <input
                            id={`editFee-${apt.id}`}
                            type="number"
                            min={0}
                            placeholder="Anlaşılan ücret"
                            value={appointmentForm.sessionFee}
                            onChange={(e) =>
                              setAppointmentForm({
                                ...appointmentForm,
                                sessionFee: e.target.value === '' ? '' : Number(e.target.value),
                              })
                            }
                          />
                        </div>
                        {rooms.length > 0 ? (
                          <div className="form-group">
                            <label>Oda</label>
                            <select
                              value={appointmentForm.roomId}
                              onChange={(e) =>
                                setAppointmentForm({
                                  ...appointmentForm,
                                  roomId: Number(e.target.value),
                                })
                              }
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
                          <label>Başlık (opsiyonel)</label>
                          <input
                            type="text"
                            value={appointmentForm.title}
                            onChange={(e) =>
                              setAppointmentForm({ ...appointmentForm, title: e.target.value })
                            }
                            placeholder="Örn: İlk görüşme"
                          />
                        </div>
                        <div className="form-group">
                          <label>Durum</label>
                          <select
                            value={appointmentForm.status}
                            onChange={(e) =>
                              setAppointmentForm({
                                ...appointmentForm,
                                status: appointmentStatus(e.target.value),
                              })
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
                              checked={appointmentForm.isPaid}
                              onChange={(e) =>
                                setAppointmentForm({ ...appointmentForm, isPaid: e.target.checked })
                              }
                            />
                            <span className="toggle-slider" />
                          </label>
                        </div>
                        <div className="form-actions-inline">
                          <button type="submit" className="submit-button" disabled={submitting}>
                            {submitting ? 'Kaydediliyor...' : 'Kaydet'}
                          </button>
                          <button
                            type="button"
                            className="cancel-button"
                            onClick={() => {
                              setEditingAppointmentId(null);
                              setAppointmentForm(emptyAppointmentForm());
                            }}
                          >
                            İptal
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                    <div className="notes-in-appointment-header">
                      <span>Randevu Notları</span>
                      <button
                        type="button"
                        className="add-note-inline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowNoteFormFor(showNoteFormFor === apt.id ? null : apt.id);
                        }}
                      >
                        {showNoteFormFor === apt.id ? 'İptal' : '+ Not Ekle'}
                      </button>
                    </div>

                    {showNoteFormFor === apt.id && (
                      <form
                        className="note-form inline-note-form"
                        onSubmit={(e) => handleAddNoteToAppointment(apt.id, e)}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="form-group">
                          <label>Başlık (opsiyonel)</label>
                          <input
                            type="text"
                            value={noteForm.title}
                            onChange={(e) =>
                              setNoteForm({ ...noteForm, title: e.target.value })
                            }
                            placeholder="Not başlığı"
                          />
                        </div>
                        <div className="form-group">
                          <label>İçerik *</label>
                          <textarea
                            value={noteForm.content}
                            onChange={(e) =>
                              setNoteForm({ ...noteForm, content: e.target.value })
                            }
                            placeholder="Not içeriği..."
                            rows={4}
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label>Tarih</label>
                          <input
                            type="date"
                            value={noteForm.noteDate}
                            onChange={(e) =>
                              setNoteForm({ ...noteForm, noteDate: e.target.value })
                            }
                            required
                          />
                        </div>
                        <button type="submit" className="submit-button" disabled={submitting}>
                          {submitting ? 'Ekleniyor...' : 'Not Ekle'}
                        </button>
                      </form>
                    )}

                    {notesByAppointment[apt.id]?.length === 0 ? (
                      <p className="no-notes-in-apt">
                        Bu randevuya henüz not eklenmemiş.
                      </p>
                    ) : (notesByAppointment[apt.id] || []).filter(noteMatchesSearch).length === 0 ? (
                      <p className="no-notes-in-apt">
                        Bu randevuda aramanızla eşleşen not yok.
                      </p>
                    ) : (
                      <div className="notes-list">
                        {(notesByAppointment[apt.id] || [])
                          .filter(noteMatchesSearch)
                          .map((note) => renderNoteCard(note))}
                      </div>
                    )}
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showAllNotesModal && (
        <div className="modal-overlay" onClick={() => setShowAllNotesModal(false)}>
          <div className="modal-content" role="dialog" aria-modal="true" aria-labelledby="all-notes-title" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 id="all-notes-title">Danışanın Tüm Notları</h2>
              <button
                className="modal-close"
                onClick={() => setShowAllNotesModal(false)}
                aria-label="Kapat"
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <input
                type="search"
                className="note-search-input note-search-input-modal"
                placeholder="Başlık veya içerikte ara..."
                value={noteSearch}
                onChange={(e) => setNoteSearch(e.target.value)}
              />
              {allNotes.length === 0 ? (
                <p className="empty-notes">Henüz not eklenmemiş.</p>
              ) : allNotes.filter(noteMatchesSearch).length === 0 ? (
                <p className="empty-notes">Aramanızla eşleşen not yok.</p>
              ) : (
                <div className="notes-list">
                  {allNotes.filter(noteMatchesSearch).map((note) => renderNoteCard(note))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
