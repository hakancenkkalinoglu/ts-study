import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getClients, getClientNotes, createNote } from '../services/api';
import type { Client, Note } from '../types';
import './ClientDetail.css';

export const ClientDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteForm, setNoteForm] = useState({
    title: '',
    content: '',
    noteDate: new Date().toISOString().split('T')[0],
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (id) {
      loadClientData();
    }
  }, [id]);

  const loadClientData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const clients = await getClients();
      const foundClient = clients.find((c) => c.id === Number(id));
      if (foundClient) {
        setClient(foundClient);
        const clientNotes = await getClientNotes(foundClient.id);
        setNotes(clientNotes);
      }
    } catch (error) {
      console.error('Error loading client data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client || !noteForm.content) return;

    try {
      setSubmitting(true);
      await createNote({
        clientId: client.id,
        title: noteForm.title || undefined,
        content: noteForm.content,
        noteDate: noteForm.noteDate,
      });
      setNoteForm({ title: '', content: '', noteDate: new Date().toISOString().split('T')[0] });
      setShowNoteForm(false);
      loadClientData();
    } catch (error) {
      console.error('Error adding note:', error);
      alert('Not eklenirken bir hata oluştu.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
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
          <button onClick={() => navigate('/')} className="back-button">
            Geri Dön
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="client-detail-container">
      <button onClick={() => navigate('/')} className="back-button">
        ← Geri Dön
      </button>

      <div className="client-info-card">
        <h1>{client.name || 'İsimsiz Danışan'}</h1>
        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">E-posta:</span>
            <span className="info-value">{client.email}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Doğum Tarihi:</span>
            <span className="info-value">{formatDate(client.birthDate)}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Kayıt Tarihi:</span>
            <span className="info-value">{formatDate(client.createdAt)}</span>
          </div>
        </div>
      </div>

      <div className="notes-section">
        <div className="notes-header">
          <h2>Randevu Notları</h2>
          <button
            className="add-note-button"
            onClick={() => setShowNoteForm(!showNoteForm)}
          >
            {showNoteForm ? 'İptal' : '+ Yeni Not Ekle'}
          </button>
        </div>

        {showNoteForm && (
          <form className="note-form" onSubmit={handleAddNote}>
            <div className="form-group">
              <label>Başlık</label>
              <input
                type="text"
                value={noteForm.title}
                onChange={(e) => setNoteForm({ ...noteForm, title: e.target.value })}
                placeholder="Not başlığı (opsiyonel)"
              />
            </div>
            <div className="form-group">
              <label>İçerik *</label>
              <textarea
                value={noteForm.content}
                onChange={(e) => setNoteForm({ ...noteForm, content: e.target.value })}
                placeholder="Not içeriği..."
                rows={5}
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
            <button type="submit" className="submit-button" disabled={submitting}>
              {submitting ? 'Ekleniyor...' : 'Not Ekle'}
            </button>
          </form>
        )}

        {notes.length === 0 ? (
          <div className="empty-notes">
            <p>Henüz not eklenmemiş.</p>
          </div>
        ) : (
          <div className="notes-list">
            {notes.map((note) => (
              <div key={note.id} className="note-card">
                <div className="note-header">
                  <h3>{note.title || 'Başlıksız Not'}</h3>
                  <span className="note-date">{formatDate(note.noteDate)}</span>
                </div>
                <p className="note-content">{note.content}</p>
                <div className="note-footer">
                  <span className="note-created">
                    Oluşturulma: {formatDate(note.createdAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
