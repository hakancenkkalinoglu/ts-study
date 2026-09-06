import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllAppointments, updateAppointment } from '../services/api';
import type { AppointmentWithClient } from '../types';
import { appointmentStatus, appointmentStatusLabel } from '../types';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import './Payments.css';

type PaymentTab = 'pending' | 'completed';

export const Payments = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<PaymentTab>('pending');
  const [appointments, setAppointments] = useState<AppointmentWithClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const loadAppointments = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getAllAppointments();
      setAppointments(data);
    } catch (error) {
      console.error('Error loading appointments:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  const pendingAppointments = appointments.filter(
    (apt) => !(apt.isPaid ?? 0) && appointmentStatus(apt.status) !== 'cancelled'
  );
  const completedAppointments = appointments.filter((apt) => apt.isPaid ?? 0);

  const handleTogglePayment = async (apt: AppointmentWithClient) => {
    try {
      setUpdatingId(apt.id);
      await updateAppointment(apt.clientId, apt.id, {
        isPaid: !(apt.isPaid ?? 0),
      });
      loadAppointments();
    } catch (error) {
      console.error('Error updating payment status:', error);
      alert('Ödeme durumu güncellenirken bir hata oluştu.');
    } finally {
      setUpdatingId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    return format(new Date(d), 'd MMMM yyyy', { locale: tr });
  };

  const formatTime = (timeStr: string | null) => timeStr || '-';

  const displayList = activeTab === 'pending' ? pendingAppointments : completedAppointments;

  const sortedList = [...displayList].sort((a, b) => {
    const dateA = a.appointmentDate + (a.appointmentTime || '00:00');
    const dateB = b.appointmentDate + (b.appointmentTime || '00:00');
    return dateA.localeCompare(dateB);
  });

  return (
    <div className="payments-container">
      <h1 className="payments-title">Ödemeler</h1>

      <div className="payments-subtabs">
        <button
          type="button"
          className={`subtab ${activeTab === 'pending' ? 'subtab-active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          Bekleyen Ödemeler
          <span className="subtab-count">({pendingAppointments.length})</span>
        </button>
        <button
          type="button"
          className={`subtab ${activeTab === 'completed' ? 'subtab-active' : ''}`}
          onClick={() => setActiveTab('completed')}
        >
          Tamamlanan Ödemeler
          <span className="subtab-count">({completedAppointments.length})</span>
        </button>
      </div>

      {loading ? (
        <div className="payments-loading">Yükleniyor...</div>
      ) : sortedList.length === 0 ? (
        <div className="payments-empty">
          <p>
            {activeTab === 'pending'
              ? 'Bekleyen ödeme bulunmuyor.'
              : 'Tamamlanan ödeme bulunmuyor.'}
          </p>
        </div>
      ) : (
        <div className="payments-list">
          <div className="payments-table-container">
            <table className="payments-table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Saat</th>
                  <th>Danışan</th>
                  <th>Başlık</th>
                  <th>Seans</th>
                  <th>Durum</th>
                  <th>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {sortedList.map((apt) => (
                  <tr key={apt.id} className="payments-row">
                    <td>{formatDate(apt.appointmentDate)}</td>
                    <td>{formatTime(apt.appointmentTime)}</td>
                    <td>
                      <button
                        type="button"
                        className="client-link"
                        onClick={() => navigate(`/client/${apt.clientId}`)}
                      >
                        {apt.clientName || 'İsimsiz'}
                      </button>
                    </td>
                    <td>{apt.title || '-'}</td>
                    <td>{appointmentStatusLabel(apt.status)}</td>
                    <td>
                      <span className={`status-badge ${apt.isPaid ? 'paid' : 'unpaid'}`}>
                        {apt.isPaid ? 'Ödendi' : 'Bekliyor'}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="toggle-payment-btn"
                        onClick={() => handleTogglePayment(apt)}
                        disabled={updatingId === apt.id}
                      >
                        {updatingId === apt.id
                          ? '...'
                          : apt.isPaid
                            ? 'Ödemeyi Geri Al'
                            : 'Ödeme Alındı'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
