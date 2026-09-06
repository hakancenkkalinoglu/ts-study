import { useState, useEffect, useCallback } from 'react';
import { getAllAppointments } from '../services/api';
import type { AppointmentWithClient } from '../types';
import { appointmentStatus } from '../types';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import './Reports.css';

const formatMoney = (amount: number) => {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M ₺`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}K ₺`;
  return `${amount} ₺`;
};

export const Reports = () => {
  const [appointments, setAppointments] = useState<AppointmentWithClient[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getAllAppointments();
      setAppointments(data);
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const getDateFromStr = (dateStr: string) => {
    const d = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    return new Date(d);
  };

  const appointmentsThisMonth = appointments.filter((a) => {
    const d = getDateFromStr(a.appointmentDate);
    return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
  });

  const appointmentsThisYear = appointments.filter((a) => {
    const d = getDateFromStr(a.appointmentDate);
    return d.getFullYear() === currentYear;
  });

  const fee = (a: AppointmentWithClient) => a.agreedFee ?? 0;

  const earnedThisMonth = appointmentsThisMonth
    .filter((a) => a.isPaid)
    .reduce((sum, a) => sum + fee(a), 0);

  const earnedThisYear = appointmentsThisYear
    .filter((a) => a.isPaid)
    .reduce((sum, a) => sum + fee(a), 0);

  const pendingTotal = appointments
    .filter((a) => !a.isPaid && appointmentStatus(a.status) !== 'cancelled')
    .reduce((sum, a) => sum + fee(a), 0);

  const chartData = [
    { name: 'Kazanılan', value: earnedThisYear, fill: '#28a745' },
    { name: 'Beklenen', value: pendingTotal, fill: '#ffc107' },
  ];

  const asOfText = format(now, "d MMM yyyy HH:mm", { locale: tr });

  if (loading) {
    return (
      <div className="reports-container">
        <h1 className="reports-title">Raporlar</h1>
        <div className="reports-loading">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="reports-container">
      <h1 className="reports-title">Raporlar</h1>
      <p className="reports-subtitle">Son güncelleme: {asOfText}</p>

      <div className="reports-grid">
        <div className="report-card">
          <h3 className="report-card-title">Bu Ay Toplam Randevu</h3>
          <p className="report-card-value report-card-value-neutral">{appointmentsThisMonth.length}</p>
          <span className="report-card-meta">As of {asOfText}</span>
        </div>

        <div className="report-card">
          <h3 className="report-card-title">Bu Yıl Toplam Randevu</h3>
          <p className="report-card-value report-card-value-neutral">{appointmentsThisYear.length}</p>
          <span className="report-card-meta">As of {asOfText}</span>
        </div>

        <div className="report-card">
          <h3 className="report-card-title">Bu Yıl Kazanılan Toplam Para</h3>
          <p className="report-card-value report-card-value-positive">{formatMoney(earnedThisYear)}</p>
          <span className="report-card-meta">As of {asOfText}</span>
        </div>

        <div className="report-card">
          <h3 className="report-card-title">Bu Ay Kazanılan Toplam Para</h3>
          <p className="report-card-value report-card-value-positive">{formatMoney(earnedThisMonth)}</p>
          <span className="report-card-meta">As of {asOfText}</span>
        </div>

        <div className="report-card">
          <h3 className="report-card-title">Bekleyen Ödemeler</h3>
          <p className="report-card-value report-card-value-pending">{formatMoney(pendingTotal)}</p>
          <span className="report-card-meta">As of {asOfText}</span>
        </div>
        
        <div className="report-card report-card-chart">
          <h3 className="report-card-title">Kazanılan vs Beklenen Para</h3>
          <div className="report-chart-wrapper">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number | undefined) => formatMoney(value ?? 0)}
                  contentStyle={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: 'var(--text-primary)' }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <span className="report-card-meta">As of {asOfText}</span>
        </div>
      </div>
    </div>
  );
};
