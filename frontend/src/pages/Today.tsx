import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllAppointments, updateAppointment } from '../services/api';
import type { AppointmentStatus, AppointmentWithClient } from '../types';
import { appointmentStatus, appointmentStatusLabel } from '../types';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import './Today.css';

const istanbulTodayYmd = (): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

const aptDateYmd = (dateStr: string): string =>
  dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.slice(0, 10);

const formatMoney = (amount: number) => `${amount} ₺`;

export const Today = () => {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<AppointmentWithClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const loadAppointments = useCallback(async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      const data = await getAllAppointments();
      setAppointments(data);
    } catch (error) {
      console.error('Error loading today appointments:', error);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  const today = istanbulTodayYmd();
  const todayList = [...appointments]
    .filter((apt) => aptDateYmd(apt.appointmentDate) === today)
    .sort((a, b) => (a.appointmentTime || '00:00').localeCompare(b.appointmentTime || '00:00'));

  const unpaidList = [...appointments]
    .filter(
      (apt) =>
        !(apt.isPaid ?? 0) &&
        appointmentStatus(apt.status) !== 'cancelled' &&
        aptDateYmd(apt.appointmentDate) <= today
    )
    .sort((a, b) => {
      const keyA = aptDateYmd(a.appointmentDate) + (a.appointmentTime || '00:00');
      const keyB = aptDateYmd(b.appointmentDate) + (b.appointmentTime || '00:00');
      return keyB.localeCompare(keyA);
    })
    .slice(0, 8);

  const formatDate = (dateStr: string) => {
    const d = aptDateYmd(dateStr);
    return format(new Date(d), 'd MMMM yyyy', { locale: tr });
  };

  const headingDate = format(new Date(today), 'd MMMM yyyy', { locale: tr });

  const handleStatus = async (apt: AppointmentWithClient, status: AppointmentStatus) => {
    const previous = apt.status;
    setStatusError(null);
    setUpdatingId(apt.id);
    setAppointments((current) =>
      current.map((item) => (item.id === apt.id ? { ...item, status } : item))
    );
    try {
      await updateAppointment(apt.clientId, apt.id, { status });
      await loadAppointments(true);
    } catch (error: unknown) {
      setAppointments((current) =>
        current.map((item) => (item.id === apt.id ? { ...item, status: previous } : item))
      );
      const msg =
        error && typeof error === 'object' && 'response' in error
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      setStatusError(msg || 'Durum kaydedilemedi. Backend yeni kodla açık mı?');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="today-container">
      <h1 className="today-title">Bugün</h1>
      <p className="today-subtitle">{headingDate}</p>
      {statusError ? <div className="today-error">{statusError}</div> : null}

      {loading ? (
        <div className="today-loading">Yükleniyor...</div>
      ) : (
        <>
          <section className="today-section">
            <h2 className="today-section-title">Bugünün seansları</h2>
            {todayList.length === 0 ? (
              <div className="today-empty">Bugün randevu yok.</div>
            ) : (
              <ul className="today-list">
                {todayList.map((apt) => (
                  <li key={apt.id} className="today-item">
                    <button
                      type="button"
                      className="today-row"
                      onClick={() => navigate(`/client/${apt.clientId}`)}
                    >
                      <span className="today-time">{apt.appointmentTime || '--:--'}</span>
                      <span className="today-main">
                        <span className="today-name">{apt.clientName || 'İsimsiz'}</span>
                        {apt.title ? <span className="today-apt-title">{apt.title}</span> : null}
                      </span>
                      <span className={`today-badge status-${appointmentStatus(apt.status)}`}>
                        {appointmentStatusLabel(apt.status)}
                      </span>
                      <span className={`today-badge ${apt.isPaid ? 'paid' : 'unpaid'}`}>
                        {apt.isPaid ? 'Ödendi' : 'Bekliyor'}
                      </span>
                    </button>
                    <div className="today-status-actions">
                      <button
                        type="button"
                        className={`today-status-btn ${appointmentStatus(apt.status) === 'attended' ? 'active-attended' : ''}`}
                        disabled={updatingId === apt.id}
                        onClick={() => handleStatus(apt, 'attended')}
                      >
                        Geldi
                      </button>
                      <button
                        type="button"
                        className={`today-status-btn ${appointmentStatus(apt.status) === 'no_show' ? 'active-noshow' : ''}`}
                        disabled={updatingId === apt.id}
                        onClick={() => handleStatus(apt, 'no_show')}
                      >
                        Gelmedi
                      </button>
                      <button
                        type="button"
                        className={`today-status-btn ${appointmentStatus(apt.status) === 'cancelled' ? 'active-cancelled' : ''}`}
                        disabled={updatingId === apt.id}
                        onClick={() => handleStatus(apt, 'cancelled')}
                      >
                        İptal
                      </button>
                    </div>
                    {apt.googleMeetLink ? (
                      <a
                        className="today-meet"
                        href={apt.googleMeetLink}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Meet
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="today-section">
            <div className="today-section-head">
              <h2 className="today-section-title">Ödenmemişler</h2>
              <button type="button" className="today-link-btn" onClick={() => navigate('/odemeler')}>
                Tüm ödemeler
              </button>
            </div>
            {unpaidList.length === 0 ? (
              <div className="today-empty today-empty-sm">Ödenmemiş randevu yok.</div>
            ) : (
              <ul className="today-list">
                {unpaidList.map((apt) => (
                  <li key={apt.id}>
                    <button
                      type="button"
                      className="today-row"
                      onClick={() => navigate(`/client/${apt.clientId}`)}
                    >
                      <span className="today-date">{formatDate(apt.appointmentDate)}</span>
                      <span className="today-time">{apt.appointmentTime || '--:--'}</span>
                      <span className="today-main">
                        <span className="today-name">{apt.clientName || 'İsimsiz'}</span>
                      </span>
                      <span className="today-fee">{formatMoney(apt.agreedFee ?? 0)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
};
