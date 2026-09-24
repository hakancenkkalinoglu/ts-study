import { useEffect, useState } from 'react';
import { CalendarCheck2, ChevronLeft, ChevronRight, DoorOpen, UsersRound } from 'lucide-react';
import { apiErrorMessage, getClinicOverview, getMyClinic } from '../services/api';
import { clinicCan } from '../types';
import type { Clinic, ClinicOverview } from '../types';
import { ClinicFeeReportSection } from '../components/ClinicFeeReport';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormError } from '@/components/ui/input';
import { Avatar, LoadingRows, PageContainer, PageHeader, StatCard } from '@/components/ui/page';

const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const WEEKDAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

const pad = (value: number) => String(value).padStart(2, '0');

const formatHours = (minutes: number) => {
  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} saat`;
};

/** Klinik sahibinin raporu: oda ücretleri (kim ödedi, kim ödemedi) ve kliniğin çalışma düzeni. */
export const ClinicOverviewPage = () => {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [data, setData] = useState<ClinicOverview | null>(null);
  const [clinic, setClinic] = useState<Clinic | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canReports = clinicCan(clinic, 'VIEW_CLINIC_REPORTS');
  const canSchedule = clinicCan(clinic, 'VIEW_CLINIC_SCHEDULE');

  useEffect(() => {
    getMyClinic()
      .then(setClinic)
      .catch((err) => {
        setClinic(null);
        setError(apiErrorMessage(err, 'Klinik bilgisi alınamadı.'));
      });
  }, []);

  useEffect(() => {
    if (!canSchedule) {
      if (clinic !== undefined) setLoading(false);
      return;
    }
    let cancelled = false;
    const last = new Date(year, month + 1, 0).getDate();
    setLoading(true);
    setError(null);
    getClinicOverview(`${year}-${pad(month + 1)}-01`, `${year}-${pad(month + 1)}-${pad(last)}`)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(apiErrorMessage(err, 'Klinik raporu alınamadı.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [year, month, canSchedule, clinic]);

  const shift = (delta: number) => {
    const next = new Date(year, month + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
  };

  const picker = (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" onClick={() => shift(-1)} aria-label="Önceki ay">
        <ChevronLeft />
      </Button>
      <span className="min-w-32 text-center text-sm font-medium">
        {MONTHS[month]} {year}
      </span>
      <Button variant="outline" size="icon" onClick={() => shift(1)} aria-label="Sonraki ay">
        <ChevronRight />
      </Button>
    </div>
  );

  return (
    <PageContainer>
      <PageHeader
        title="Klinik Raporu"
        description="Odalardan doğan gelir, psikologların oda ücreti ödemeleri ve kliniğin çalışma düzeni. Danışan ve psikolog kazancı gösterilmez."
        actions={picker}
      />
      {error ? <FormError>{error}</FormError> : null}
      {canReports ? (
        <ClinicFeeReportSection
          year={year}
          month={month}
          monthLabel={MONTHS[month]}
          canManagePayments={clinicCan(clinic, 'MANAGE_PAYMENTS')}
        />
      ) : null}
      {!canSchedule ? null : loading && !data ? (
        <Card>
          <LoadingRows rows={4} />
        </Card>
      ) : data ? (
        <>
          <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Özet">
            <StatCard icon={CalendarCheck2} label={`${MONTHS[month]} seansları`} value={String(data.sessions)} hint="İptaller hariç" />
            <StatCard icon={UsersRound} label="Psikolog" value={String(data.therapists.length)} hint="Kliniğe bağlı" />
            <StatCard icon={DoorOpen} label="Oda" value={String(data.rooms.length)} hint="Tanımlı oda sayısı" />
            <StatCard
              icon={CalendarCheck2}
              label="İptal / gelmedi"
              value={`${data.cancelled} / ${data.noShow}`}
              hint="Bu ay"
              tone={data.noShow > 0 ? 'warning' : 'default'}
            />
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Psikologlar</CardTitle>
                  <CardDescription className="mt-1">Seans yaptıkları oda ve günler</CardDescription>
                </div>
                <UsersRound className="size-4 text-muted-foreground" />
              </CardHeader>
              <ul className="m-0 mt-3 list-none divide-y divide-border p-0">
                {data.therapists.map((therapist) => (
                  <li key={therapist.userId} className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={therapist.name} />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{therapist.name}</span>
                      {therapist.role === 'owner' ? <Badge variant="warning">Kurucu</Badge> : null}
                      <span className="text-sm tabular-nums text-muted-foreground">{therapist.sessions} seans</span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-12">
                      {therapist.weekdays.length === 0 ? (
                        <span className="text-xs text-muted-foreground">Bu ay seans yok</span>
                      ) : (
                        <>
                          {therapist.weekdays.map((day) => (
                            <Badge key={day}>{WEEKDAYS[day - 1]}</Badge>
                          ))}
                          <span className="text-xs text-muted-foreground">· {therapist.rooms.join(', ') || 'Oda atanmamış'}</span>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>

            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Odalar</CardTitle>
                  <CardDescription className="mt-1">Seans sayısı ve kullanım süresi</CardDescription>
                </div>
                <DoorOpen className="size-4 text-muted-foreground" />
              </CardHeader>
              <ul className="m-0 mt-3 list-none divide-y divide-border p-0">
                {data.rooms.map((room) => (
                  <li key={room.roomId} className="flex items-center gap-3 px-5 py-3">
                    <span className="size-4 shrink-0 rounded" style={{ background: room.color || 'var(--muted-foreground)' }} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{room.name}</span>
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {room.sessions} seans · {formatHours(room.minutes)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </>
      ) : null}
    </PageContainer>
  );
};
