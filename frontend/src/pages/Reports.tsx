import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllAppointments } from '../services/api';
import type { AppointmentWithClient } from '../types';
import { appointmentAmount, appointmentPaid, appointmentStatus, appointmentStatusLabel } from '../types';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import './Reports.css';

type ClientSessionRow = {
  clientId: number;
  clientName: string;
  sessions: number;
  attended: number;
  noShow: number;
  paid: number;
  pendingAmount: number;
};

type ClientDebtRow = {
  clientId: number;
  clientName: string;
  pendingCount: number;
  pendingAmount: number;
};

const formatMoney = (amount: number) =>
  `${amount.toLocaleString('tr-TR')} ₺`;

const MONTHS = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
];

const parseAptDate = (dateStr: string) => {
  const part = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.slice(0, 10);
  const [year, month, day] = part.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
};

export const Reports = () => {
  const navigate = useNavigate();
  const now = new Date();
  const [appointments, setAppointments] = useState<AppointmentWithClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());

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

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') {
        loadData();
      }
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [loadData]);

  const yearsFromData = appointments.map((a) => parseAptDate(a.appointmentDate).getFullYear());
  const minYear = yearsFromData.length
    ? Math.min(...yearsFromData, now.getFullYear(), selectedYear)
    : Math.min(now.getFullYear() - 2, selectedYear);
  const maxYear = yearsFromData.length
    ? Math.max(...yearsFromData, now.getFullYear(), selectedYear)
    : Math.max(now.getFullYear(), selectedYear);
  const yearOptions: number[] = [];
  for (let year = maxYear; year >= minYear; year -= 1) {
    yearOptions.push(year);
  }

  const isCurrentPeriod = selectedYear === now.getFullYear() && selectedMonth === now.getMonth();
  const monthLabel = `${MONTHS[selectedMonth]} ${selectedYear}`;

  const goPrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear((year) => year - 1);
    } else {
      setSelectedMonth((month) => month - 1);
    }
  };

  const goNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear((year) => year + 1);
    } else {
      setSelectedMonth((month) => month + 1);
    }
  };

  const appointmentsThisMonth = appointments.filter((a) => {
    const d = parseAptDate(a.appointmentDate);
    return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
  });

  const appointmentsThisYear = appointments.filter((a) => {
    const d = parseAptDate(a.appointmentDate);
    return d.getFullYear() === selectedYear;
  });

  const countedThisMonth = appointmentsThisMonth.filter(
    (a) => appointmentStatus(a.status) !== 'cancelled'
  );
  const countedThisYear = appointmentsThisYear.filter(
    (a) => appointmentStatus(a.status) !== 'cancelled'
  );

  const monthTotal = appointmentsThisMonth.length;
  const statusBreakdown = (
    [
      { key: 'attended' as const, color: '#228b22' },
      { key: 'no_show' as const, color: '#c0392b' },
      { key: 'cancelled' as const, color: '#6c757d' },
      { key: 'scheduled' as const, color: '#6c757d' },
    ] as const
  ).map((row) => {
    const count = appointmentsThisMonth.filter((a) => appointmentStatus(a.status) === row.key).length;
    const percent = monthTotal === 0 ? 0 : Math.round((count / monthTotal) * 100);
    return {
      key: row.key,
      label: appointmentStatusLabel(row.key),
      count,
      percent,
      color: row.color,
    };
  });

  const fee = (a: AppointmentWithClient) => appointmentAmount(a);

  const paidThisMonth = appointmentsThisMonth.filter((a) => appointmentPaid(a.isPaid));
  const pendingThisMonth = appointmentsThisMonth.filter(
    (a) => !appointmentPaid(a.isPaid) && appointmentStatus(a.status) !== 'cancelled'
  );
  const paidThisYear = appointmentsThisYear.filter((a) => appointmentPaid(a.isPaid));
  const pendingThisYear = appointmentsThisYear.filter(
    (a) => !appointmentPaid(a.isPaid) && appointmentStatus(a.status) !== 'cancelled'
  );

  const earnedThisMonth = paidThisMonth.reduce((sum, a) => sum + fee(a), 0);
  const earnedThisYear = paidThisYear.reduce((sum, a) => sum + fee(a), 0);
  const pendingMonth = pendingThisMonth.reduce((sum, a) => sum + fee(a), 0);
  const pendingYear = pendingThisYear.reduce((sum, a) => sum + fee(a), 0);
  const paymentTotal = paidThisMonth.length + pendingThisMonth.length;
  const paymentBreakdown = [
    {
      key: 'paid',
      label: 'Ödendi',
      count: paidThisMonth.length,
      amount: earnedThisMonth,
      percent: paymentTotal === 0 ? 0 : Math.round((paidThisMonth.length / paymentTotal) * 100),
      color: '#28a745',
    },
    {
      key: 'pending',
      label: 'Bekliyor',
      count: pendingThisMonth.length,
      amount: pendingMonth,
      percent: paymentTotal === 0 ? 0 : Math.round((pendingThisMonth.length / paymentTotal) * 100),
      color: '#d4a017',
    },
  ];

  const chartData = [
    { name: 'Kazanılan', value: earnedThisYear, fill: '#28a745' },
    { name: 'Beklenen', value: pendingYear, fill: '#ffc107' },
  ];

  const sessionByClient = new Map<number, ClientSessionRow>();
  for (const apt of countedThisMonth) {
    const existing = sessionByClient.get(apt.clientId);
    const status = appointmentStatus(apt.status);
    if (existing) {
      existing.sessions += 1;
      if (status === 'attended') existing.attended += 1;
      if (status === 'no_show') existing.noShow += 1;
      if (appointmentPaid(apt.isPaid)) existing.paid += 1;
      else existing.pendingAmount += fee(apt);
    } else {
      sessionByClient.set(apt.clientId, {
        clientId: apt.clientId,
        clientName: apt.clientName || 'İsimsiz',
        sessions: 1,
        attended: status === 'attended' ? 1 : 0,
        noShow: status === 'no_show' ? 1 : 0,
        paid: appointmentPaid(apt.isPaid) ? 1 : 0,
        pendingAmount: appointmentPaid(apt.isPaid) ? 0 : fee(apt),
      });
    }
  }
  const sessionRows = [...sessionByClient.values()].sort((a, b) => {
    if (b.sessions !== a.sessions) return b.sessions - a.sessions;
    return a.clientName.localeCompare(b.clientName, 'tr');
  });

  const debtByClient = new Map<number, ClientDebtRow>();
  for (const apt of appointments) {
    if (appointmentPaid(apt.isPaid) || appointmentStatus(apt.status) === 'cancelled') continue;
    const existing = debtByClient.get(apt.clientId);
    if (existing) {
      existing.pendingCount += 1;
      existing.pendingAmount += fee(apt);
    } else {
      debtByClient.set(apt.clientId, {
        clientId: apt.clientId,
        clientName: apt.clientName || 'İsimsiz',
        pendingCount: 1,
        pendingAmount: fee(apt),
      });
    }
  }
  const debtRows = [...debtByClient.values()].sort((a, b) => {
    if (b.pendingAmount !== a.pendingAmount) return b.pendingAmount - a.pendingAmount;
    return a.clientName.localeCompare(b.clientName, 'tr');
  });

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

      <div className="reports-period">
        <button type="button" className="reports-period-nav" onClick={goPrevMonth}>
          ‹
        </button>
        <select
          className="reports-period-select"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(Number(e.target.value))}
          aria-label="Ay"
        >
          {MONTHS.map((name, index) => (
            <option key={name} value={index}>
              {name}
            </option>
          ))}
        </select>
        <select
          className="reports-period-select"
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          aria-label="Yıl"
        >
          {yearOptions.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
        <button type="button" className="reports-period-nav" onClick={goNextMonth}>
          ›
        </button>
        {!isCurrentPeriod ? (
          <button
            type="button"
            className="reports-period-today"
            onClick={() => {
              setSelectedYear(now.getFullYear());
              setSelectedMonth(now.getMonth());
            }}
          >
            Bu aya dön
          </button>
        ) : null}
      </div>

      <div className="reports-grid">
        <div className="report-card">
          <h3 className="report-card-title">{monthLabel} randevu</h3>
          <p className="report-card-value report-card-value-neutral">{countedThisMonth.length}</p>
          <span className="report-card-meta">İptaller hariç · {monthLabel}</span>
        </div>

        <div className="report-card">
          <h3 className="report-card-title">{selectedYear} randevu</h3>
          <p className="report-card-value report-card-value-neutral">{countedThisYear.length}</p>
          <span className="report-card-meta">İptaller hariç · {selectedYear}</span>
        </div>

        <div className="report-card">
          <h3 className="report-card-title">{selectedYear} tahsil edilen</h3>
          <p className="report-card-value report-card-value-positive">{formatMoney(earnedThisYear)}</p>
          <span className="report-card-meta">{paidThisYear.length} seans ödendi · {selectedYear}</span>
        </div>

        <div className="report-card">
          <h3 className="report-card-title">{monthLabel} tahsil edilen</h3>
          <p className="report-card-value report-card-value-positive">{formatMoney(earnedThisMonth)}</p>
          <span className="report-card-meta">{paidThisMonth.length} seans ödendi · {monthLabel}</span>
        </div>

        <div className="report-card report-card-status">
          <h3 className="report-card-title">{monthLabel} durum</h3>
          {monthTotal === 0 ? (
            <p className="report-status-empty">Bu ayda randevu yok.</p>
          ) : (
            <ul className="report-status-list">
              {statusBreakdown.map((row) => (
                <li key={row.key}>
                  <span className="report-status-dot" style={{ background: row.color }} />
                  <span className="report-status-label">{row.label}</span>
                  <span className="report-status-count">{row.count}</span>
                  <span className="report-status-percent">{row.percent}%</span>
                </li>
              ))}
            </ul>
          )}
          <span className="report-card-meta">Yüzde tüm randevulara göre · {monthLabel}</span>
        </div>

        <div className="report-card report-card-status">
          <h3 className="report-card-title">{monthLabel} ödeme</h3>
          {paymentTotal === 0 ? (
            <p className="report-status-empty">Bu ayda sayılan randevu yok.</p>
          ) : (
            <ul className="report-status-list with-amount">
              {paymentBreakdown.map((row) => (
                <li key={row.key}>
                  <span className="report-status-dot" style={{ background: row.color }} />
                  <span className="report-status-label">{row.label}</span>
                  <span className="report-status-count">{row.count}</span>
                  <span className="report-status-percent">{row.percent}%</span>
                  <span className="report-status-amount">{formatMoney(row.amount)}</span>
                </li>
              ))}
            </ul>
          )}
          <span className="report-card-meta">İptaller hariç · ödeme işareti değişince güncellenir · {monthLabel}</span>
        </div>

        <div className="report-card">
          <h3 className="report-card-title">{monthLabel} bekleyen</h3>
          <p className="report-card-value report-card-value-pending">{formatMoney(pendingMonth)}</p>
          <span className="report-card-meta">{pendingThisMonth.length} seans bekliyor · {monthLabel}</span>
        </div>
        
        <div className="report-card report-card-chart">
          <h3 className="report-card-title">{selectedYear} kazanılan vs beklenen</h3>
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
          <span className="report-card-meta">{selectedYear}</span>
        </div>
      </div>

      <div className="reports-client-grid">
        <div className="report-card report-card-table">
          <h3 className="report-card-title">{monthLabel} danışan seansları</h3>
          {sessionRows.length === 0 ? (
            <p className="report-status-empty">Bu ayda sayılan randevu yok.</p>
          ) : (
            <div className="reports-table-wrap">
              <table className="reports-table">
                <thead>
                  <tr>
                    <th>Danışan</th>
                    <th>Seans</th>
                    <th>Geldi</th>
                    <th>Gelmedi</th>
                    <th>Ödendi</th>
                    <th>Bekleyen</th>
                  </tr>
                </thead>
                <tbody>
                  {sessionRows.map((row) => (
                    <tr key={row.clientId}>
                      <td>
                        <button
                          type="button"
                          className="reports-client-link"
                          onClick={() => navigate(`/client/${row.clientId}`)}
                        >
                          {row.clientName}
                        </button>
                      </td>
                      <td>{row.sessions}</td>
                      <td>{row.attended}</td>
                      <td>{row.noShow}</td>
                      <td>{row.paid}</td>
                      <td>{formatMoney(row.pendingAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <span className="report-card-meta">İptaller hariç · çok seans üstte · {monthLabel}</span>
        </div>

        <div className="report-card report-card-table">
          <h3 className="report-card-title">Borçlu danışanlar</h3>
          {debtRows.length === 0 ? (
            <p className="report-status-empty">Bekleyen ödeme yok.</p>
          ) : (
            <div className="reports-table-wrap">
              <table className="reports-table">
                <thead>
                  <tr>
                    <th>Danışan</th>
                    <th>Bekleyen seans</th>
                    <th>Tutar</th>
                  </tr>
                </thead>
                <tbody>
                  {debtRows.map((row) => (
                    <tr key={row.clientId}>
                      <td>
                        <button
                          type="button"
                          className="reports-client-link"
                          onClick={() => navigate(`/client/${row.clientId}`)}
                        >
                          {row.clientName}
                        </button>
                      </td>
                      <td>{row.pendingCount}</td>
                      <td className="reports-debt-amount">{formatMoney(row.pendingAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <span className="report-card-meta">Ödemeler ile aynı kural: ödenmemiş, iptal hariç, tüm zamanlar</span>
        </div>
      </div>
    </div>
  );
};
