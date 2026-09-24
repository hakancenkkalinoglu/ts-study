import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Banknote, CalendarCheck2, ChevronLeft, ChevronRight, Hourglass, TrendingUp } from 'lucide-react';
import { getAllAppointments } from '../services/api';
import type { AppointmentWithClient } from '../types';
import { appointmentAmount, appointmentPaid, appointmentStatus, appointmentStatusLabel } from '../types';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { ClinicEarnings } from '../components/ClinicEarnings';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { NativeSelect } from '@/components/ui/input';
import { Avatar, LoadingRows, PageContainer, PageHeader, StatCard } from '@/components/ui/page';

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

const formatMoney = (amount: number) => `${amount.toLocaleString('tr-TR')} ₺`;

const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

const parseAptDate = (dateStr: string) => {
  const part = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.slice(0, 10);
  const [year, month, day] = part.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
};

const BreakdownList = ({
  rows,
  showAmount = false,
}: {
  rows: { key: string; label: string; count: number; percent: number; color: string; amount?: number }[];
  showAmount?: boolean;
}) => (
  <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
    {rows.map((row) => (
      <li key={row.key}>
        <div className="mb-1.5 flex items-center gap-2 text-sm">
          <span className="size-2 rounded-full" style={{ background: row.color }} />
          <span className="flex-1">{row.label}</span>
          <span className="tabular-nums text-muted-foreground">
            {row.count} · %{row.percent}
          </span>
          {showAmount && row.amount != null ? (
            <span className="w-24 text-right font-medium tabular-nums">{formatMoney(row.amount)}</span>
          ) : null}
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full transition-[width]" style={{ width: `${row.percent}%`, background: row.color }} />
        </div>
      </li>
    ))}
  </ul>
);

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

  const countedThisMonth = appointmentsThisMonth.filter((a) => appointmentStatus(a.status) !== 'cancelled');
  const countedThisYear = appointmentsThisYear.filter((a) => appointmentStatus(a.status) !== 'cancelled');

  const monthTotal = appointmentsThisMonth.length;
  const statusBreakdown = (
    [
      { key: 'attended' as const, color: 'var(--success)' },
      { key: 'no_show' as const, color: 'var(--destructive)' },
      { key: 'scheduled' as const, color: 'var(--primary)' },
      { key: 'cancelled' as const, color: 'var(--muted-foreground)' },
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
      color: 'var(--success)',
    },
    {
      key: 'pending',
      label: 'Bekliyor',
      count: pendingThisMonth.length,
      amount: pendingMonth,
      percent: paymentTotal === 0 ? 0 : Math.round((pendingThisMonth.length / paymentTotal) * 100),
      color: 'var(--warning)',
    },
  ];

  const chartData = [
    { name: 'Tahsil edilen', value: earnedThisYear, fill: 'var(--success)' },
    { name: 'Bekleyen', value: pendingYear, fill: 'var(--warning)' },
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

  const asOfText = format(now, 'd MMM yyyy HH:mm', { locale: tr });

  const periodPicker = (
    <>
      <Button variant="outline" size="icon" onClick={goPrevMonth} aria-label="Önceki ay">
        <ChevronLeft />
      </Button>
      <NativeSelect
        className="w-auto"
        value={selectedMonth}
        onChange={(e) => setSelectedMonth(Number(e.target.value))}
        aria-label="Ay"
      >
        {MONTHS.map((name, index) => (
          <option key={name} value={index}>
            {name}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect
        className="w-auto"
        value={selectedYear}
        onChange={(e) => setSelectedYear(Number(e.target.value))}
        aria-label="Yıl"
      >
        {yearOptions.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </NativeSelect>
      <Button variant="outline" size="icon" onClick={goNextMonth} aria-label="Sonraki ay">
        <ChevronRight />
      </Button>
      {!isCurrentPeriod ? (
        <Button
          variant="ghost"
          onClick={() => {
            setSelectedYear(now.getFullYear());
            setSelectedMonth(now.getMonth());
          }}
        >
          Bu ay
        </Button>
      ) : null}
    </>
  );

  return (
    <PageContainer>
      <PageHeader title="Raporlar" description={`Son güncelleme: ${asOfText}`} actions={periodPicker} />

      {loading ? (
        <Card>
          <LoadingRows rows={5} />
        </Card>
      ) : (
        <>
          <ClinicEarnings year={selectedYear} month={selectedMonth} monthLabel={MONTHS[selectedMonth]} />
          <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Özet">
            <StatCard
              icon={CalendarCheck2}
              label={`${MONTHS[selectedMonth]} seansları`}
              value={String(countedThisMonth.length)}
              hint={`${selectedYear} toplamı: ${countedThisYear.length} · iptaller hariç`}
            />
            <StatCard
              icon={Banknote}
              label={`${MONTHS[selectedMonth]} tahsilat`}
              value={formatMoney(earnedThisMonth)}
              hint={`${paidThisMonth.length} seans ödendi`}
              tone="success"
            />
            <StatCard
              icon={Hourglass}
              label={`${MONTHS[selectedMonth]} bekleyen`}
              value={formatMoney(pendingMonth)}
              hint={`${pendingThisMonth.length} seans bekliyor`}
              tone={pendingMonth > 0 ? 'warning' : 'default'}
            />
            <StatCard
              icon={TrendingUp}
              label={`${selectedYear} tahsilat`}
              value={formatMoney(earnedThisYear)}
              hint={`${paidThisYear.length} seans ödendi`}
              tone="success"
            />
          </section>

          <div className="mb-6 grid gap-6 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Seans durumu</CardTitle>
                  <CardDescription className="mt-1">{monthLabel} · tüm randevular</CardDescription>
                </div>
              </CardHeader>
              <div className="p-5">
                {monthTotal === 0 ? (
                  <p className="m-0 text-sm text-muted-foreground">Bu ayda randevu yok.</p>
                ) : (
                  <BreakdownList rows={statusBreakdown} />
                )}
              </div>
            </Card>
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Ödeme durumu</CardTitle>
                  <CardDescription className="mt-1">{monthLabel} · iptaller hariç</CardDescription>
                </div>
              </CardHeader>
              <div className="p-5">
                {paymentTotal === 0 ? (
                  <p className="m-0 text-sm text-muted-foreground">Bu ayda sayılan randevu yok.</p>
                ) : (
                  <BreakdownList rows={paymentBreakdown} showAmount />
                )}
              </div>
            </Card>
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>{selectedYear} tahsilat ve bekleyen</CardTitle>
                  <CardDescription className="mt-1">Yıl toplamı</CardDescription>
                </div>
              </CardHeader>
              <div className="px-2 pb-2">
                {earnedThisYear + pendingYear === 0 ? (
                  <p className="m-0 px-3 py-5 text-sm text-muted-foreground">Bu yıl için veri yok.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={chartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={2}
                        stroke="var(--card)"
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={index} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number | undefined) => formatMoney(value ?? 0)}
                        contentStyle={{
                          background: 'var(--popover)',
                          border: '1px solid var(--border)',
                          borderRadius: '8px',
                          fontSize: 13,
                        }}
                        itemStyle={{ color: 'var(--popover-foreground)' }}
                      />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 13 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <Card className="overflow-hidden">
              <CardHeader>
                <div>
                  <CardTitle>Danışan seansları</CardTitle>
                  <CardDescription className="mt-1">{monthLabel} · iptaller hariç</CardDescription>
                </div>
              </CardHeader>
              {sessionRows.length === 0 ? (
                <p className="m-0 px-5 py-5 text-sm text-muted-foreground">Bu ayda sayılan randevu yok.</p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-0 border-y border-solid bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-5 py-2.5 font-medium">Danışan</th>
                        <th className="px-3 py-2.5 text-right font-medium">Seans</th>
                        <th className="px-3 py-2.5 text-right font-medium">Geldi</th>
                        <th className="px-3 py-2.5 text-right font-medium">Gelmedi</th>
                        <th className="px-3 py-2.5 text-right font-medium">Ödendi</th>
                        <th className="px-5 py-2.5 text-right font-medium">Bekleyen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessionRows.map((row) => (
                        <tr key={row.clientId} className="border-0 border-b border-solid last:border-b-0">
                          <td className="px-5 py-2.5">
                            <button
                              type="button"
                              onClick={() => navigate(`/client/${row.clientId}`)}
                              className="flex cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-left font-medium text-foreground [font-family:inherit] hover:underline"
                            >
                              <Avatar name={row.clientName} className="size-7 text-[11px]" />
                              {row.clientName}
                            </button>
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{row.sessions}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{row.attended}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{row.noShow}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{row.paid}</td>
                          <td className="px-5 py-2.5 text-right tabular-nums">{formatMoney(row.pendingAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card className="overflow-hidden">
              <CardHeader>
                <div>
                  <CardTitle>Borçlu danışanlar</CardTitle>
                  <CardDescription className="mt-1">Ödenmemiş seanslar · tüm zamanlar</CardDescription>
                </div>
              </CardHeader>
              {debtRows.length === 0 ? (
                <p className="m-0 px-5 py-5 text-sm text-muted-foreground">Bekleyen ödeme yok.</p>
              ) : (
                <ul className="m-0 mt-3 list-none divide-y divide-border p-0">
                  {debtRows.map((row) => (
                    <li key={row.clientId} className="flex items-center gap-3 px-5 py-3">
                      <Avatar name={row.clientName} className="size-8 text-xs" />
                      <button
                        type="button"
                        onClick={() => navigate(`/client/${row.clientId}`)}
                        className="min-w-0 flex-1 cursor-pointer border-0 bg-transparent p-0 text-left text-foreground [font-family:inherit]"
                      >
                        <span className="block truncate text-sm font-medium hover:underline">{row.clientName}</span>
                        <span className="block text-[13px] text-muted-foreground">{row.pendingCount} seans</span>
                      </button>
                      <span className="text-sm font-semibold tabular-nums text-warning">{formatMoney(row.pendingAmount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </PageContainer>
  );
};
