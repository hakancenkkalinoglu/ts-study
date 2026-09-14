import { useState, useEffect, useCallback, type FormEvent } from 'react';
import {
  createClinic,
  createClinicRoom,
  deleteClinic,
  deleteClinicRoom,
  getMyClinic,
  joinClinic,
  kickClinicMember,
  leaveClinic,
  renameClinic,
  rotateClinicInvite,
  transferClinicOwnership,
  updateClinicRoom,
  apiErrorMessage,
} from '../services/api';
import type { Clinic } from '../types';
import './Clinic.css';

export const ClinicPage = () => {
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clinicName, setClinicName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [roomName, setRoomName] = useState('');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [editingRoomId, setEditingRoomId] = useState<number | null>(null);
  const [editingRoomName, setEditingRoomName] = useState('');
  const [editingRoomColor, setEditingRoomColor] = useState('#4f46e5');
  const isOwner = clinic?.role === 'owner';

  const loadClinic = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getMyClinic();
      setClinic(data);
      if (data) {
        setRenameValue(data.name);
      }
    } catch (err) {
      setError(apiErrorMessage(err, 'Klinik bilgisi alınamadı.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClinic();
  }, [loadClinic]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      setClinic(await createClinic(clinicName));
      setClinicName('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Klinik oluşturulamadı.'));
    } finally {
      setSaving(false);
    }
  };

  const handleJoin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      setClinic(await joinClinic(inviteCode));
      setInviteCode('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Kliniğe katılınamadı.'));
    } finally {
      setSaving(false);
    }
  };

  const handleAddRoom = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await createClinicRoom(roomName);
      setRoomName('');
      await loadClinic();
    } catch (err) {
      setError(apiErrorMessage(err, 'Oda eklenemedi.'));
    } finally {
      setSaving(false);
    }
  };

  const handleCopyCode = async () => {
    if (!clinic) return;
    try {
      await navigator.clipboard.writeText(clinic.inviteCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Kod kopyalanamadı.');
    }
  };

  const handleLeave = async () => {
    if (!window.confirm('Klinikten ayrılmak istiyor musunuz?')) return;
    setError(null);
    try {
      await leaveClinic();
      setClinic(null);
    } catch (err) {
      setError(apiErrorMessage(err, 'Ayrılamadınız.'));
    }
  };

  const handleDeleteClinic = async () => {
    if (!window.confirm('Klinik ve odalar silinsin mi? Randevular kalır, oda bilgisi gider.')) return;
    setError(null);
    try {
      await deleteClinic();
      setClinic(null);
    } catch (err) {
      setError(apiErrorMessage(err, 'Klinik silinemedi.'));
    }
  };

  const handleDeleteRoom = async (roomId: number, name: string) => {
    if (!window.confirm(`${name} silinsin mi?`)) return;
    setError(null);
    try {
      await deleteClinicRoom(roomId);
      await loadClinic();
    } catch (err) {
      setError(apiErrorMessage(err, 'Oda silinemedi.'));
    }
  };

  const handleRename = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      setClinic(await renameClinic(renameValue));
    } catch (err) {
      setError(apiErrorMessage(err, 'Klinik adı güncellenemedi.'));
    }
  };

  const handleRotate = async () => {
    if (!window.confirm('Davet kodu yenilensin mi? Eski kod çalışmaz.')) return;
    setError(null);
    try {
      setClinic(await rotateClinicInvite());
    } catch (err) {
      setError(apiErrorMessage(err, 'Kod yenilenemedi.'));
    }
  };

  const handleKick = async (userId: number, name: string) => {
    if (!window.confirm(`${name} klinikten çıkarılsın mı?`)) return;
    setError(null);
    try {
      setClinic(await kickClinicMember(userId));
    } catch (err) {
      setError(apiErrorMessage(err, 'Üye çıkarılamadı.'));
    }
  };

  const handleTransfer = async (userId: number, name: string) => {
    if (!window.confirm(`Sahiplik ${name} kişisine geçsin mi? Siz üye olursunuz.`)) return;
    setError(null);
    try {
      setClinic(await transferClinicOwnership(userId));
    } catch (err) {
      setError(apiErrorMessage(err, 'Sahiplik devredilemedi.'));
    }
  };

  const handleSaveRoom = async (e: FormEvent) => {
    e.preventDefault();
    if (editingRoomId == null) return;
    setError(null);
    try {
      await updateClinicRoom(editingRoomId, { name: editingRoomName, color: editingRoomColor });
      setEditingRoomId(null);
      await loadClinic();
    } catch (err) {
      setError(apiErrorMessage(err, 'Oda güncellenemedi.'));
    }
  };

  if (loading) {
    return (
      <div className="clinic-container">
        <div className="clinic-loading">Yükleniyor...</div>
      </div>
    );
  }

  if (!clinic) {
    return (
      <div className="clinic-container">
        <h1>Klinik</h1>
        <p className="clinic-lead">
          Ortak ofiste odaları ve meslektaş takvimini görmek için bir klinik oluşturun veya davet kodu ile katılın.
          Notlar yine size özel kalır.
        </p>
        {error ? <div className="clinic-error">{error}</div> : null}
        <div className="clinic-setup">
          <form className="clinic-card" onSubmit={handleCreate}>
            <h2>Klinik oluştur</h2>
            <label htmlFor="clinic-name">Klinik adı</label>
            <input
              id="clinic-name"
              value={clinicName}
              onChange={(e) => setClinicName(e.target.value)}
              placeholder="Örn. Kadıköy Muayenehane"
              required
            />
            <button type="submit" className="clinic-primary" disabled={saving}>
              Oluştur
            </button>
          </form>
          <form className="clinic-card" onSubmit={handleJoin}>
            <h2>Davet kodu ile katıl</h2>
            <label htmlFor="invite-code">Davet kodu</label>
            <input
              id="invite-code"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              required
            />
            <button type="submit" className="clinic-primary" disabled={saving}>
              Katıl
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="clinic-container">
      <div className="clinic-head">
        <div>
          <h1>{clinic.name}</h1>
          <p className="clinic-lead">
            {clinic.role === 'owner' ? 'Kurucusunuz.' : 'Üyesiniz.'} Meslektaşınız takvimde saat ve oda görür; danışan adı, not ve ücret gizlenir.
          </p>
        </div>
        <div className="clinic-code-box">
          <span className="clinic-code-label">Davet kodu</span>
          <strong>{clinic.inviteCode}</strong>
          <button type="button" className="clinic-secondary" onClick={handleCopyCode}>
            {copied ? 'Kopyalandı' : 'Kopyala'}
          </button>
          {isOwner ? (
            <button type="button" className="clinic-secondary" onClick={() => void handleRotate()}>
              Kodu yenile
            </button>
          ) : null}
        </div>
      </div>
      {error ? <div className="clinic-error">{error}</div> : null}

      {isOwner ? (
        <form className="clinic-card" onSubmit={handleRename}>
          <h2>Klinik adı</h2>
          <label htmlFor="rename-clinic">Ad</label>
          <input
            id="rename-clinic"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            required
          />
          <button type="submit" className="clinic-primary" disabled={saving}>
            Adı kaydet
          </button>
        </form>
      ) : null}

      <section className="clinic-card">
        <h2>Terapistler</h2>
        <ul className="clinic-list">
          {clinic.members.map((member) => (
            <li key={member.userId}>
              <span>{member.name}</span>
              <span className="clinic-role">{member.role === 'owner' ? 'Kurucu' : 'Üye'}</span>
              {isOwner && member.role !== 'owner' ? (
                <span className="clinic-member-actions">
                  <button type="button" className="clinic-link" onClick={() => void handleKick(member.userId, member.name)}>
                    Çıkar
                  </button>
                  <button type="button" className="clinic-link" onClick={() => void handleTransfer(member.userId, member.name)}>
                    Kurucu yap
                  </button>
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="clinic-card">
        <h2>Odalar</h2>
        <ul className="clinic-list">
          {clinic.rooms.map((room) => (
            <li key={room.id}>
              {editingRoomId === room.id ? (
                <form className="clinic-inline-form" onSubmit={handleSaveRoom}>
                  <input
                    value={editingRoomName}
                    onChange={(e) => setEditingRoomName(e.target.value)}
                    aria-label="Oda adı"
                    required
                  />
                  <input
                    type="color"
                    value={editingRoomColor}
                    onChange={(e) => setEditingRoomColor(e.target.value)}
                    aria-label="Oda rengi"
                  />
                  <button type="submit" className="clinic-primary">
                    Kaydet
                  </button>
                  <button type="button" className="clinic-secondary" onClick={() => setEditingRoomId(null)}>
                    Vazgeç
                  </button>
                </form>
              ) : (
                <>
                  <span className="clinic-room-swatch" style={{ background: room.color || '#888' }} />
                  <span>{room.name}</span>
                  {isOwner ? (
                    <>
                      <button
                        type="button"
                        className="clinic-link"
                        onClick={() => {
                          setEditingRoomId(room.id);
                          setEditingRoomName(room.name);
                          setEditingRoomColor(room.color || '#4f46e5');
                        }}
                      >
                        Düzenle
                      </button>
                      <button type="button" className="clinic-link" onClick={() => handleDeleteRoom(room.id, room.name)}>
                        Sil
                      </button>
                    </>
                  ) : null}
                </>
              )}
            </li>
          ))}
        </ul>
        {isOwner ? (
          <form className="clinic-inline-form" onSubmit={handleAddRoom}>
            <label className="sr-only" htmlFor="new-room">
              Yeni oda adı
            </label>
            <input
              id="new-room"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="Yeni oda adı"
              required
            />
            <button type="submit" className="clinic-primary" disabled={saving}>
              Oda ekle
            </button>
          </form>
        ) : null}
      </section>

      <div className="clinic-danger">
        {clinic.role === 'owner' ? (
          <button type="button" className="clinic-danger-btn" onClick={handleDeleteClinic}>
            Kliniği sil
          </button>
        ) : (
          <button type="button" className="clinic-danger-btn" onClick={handleLeave}>
            Klinikten ayrıl
          </button>
        )}
      </div>
    </div>
  );
};
