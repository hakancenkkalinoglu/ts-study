import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
  Banknote,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  Check,
  CircleDashed,
  Clock3,
  MoreHorizontal,
  Undo2,
  UserRound,
  UserX,
  Video,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react';
import { apiErrorMessage, getAllAppointments, getProfile, getUpcomingAppointments, updateAppointment } from '@/services/api';
import type { AppointmentStatus, AppointmentWithClient, UpdateAppointmentInput } from '@/types';
import { appointmentAmount, appointmentPaid, appointmentStatus, appointmentStatusLabel, sessionDurationLabel } from '@/types';
import { istanbulTodayYmd } from '@/utils/dates';
import { useToast } from '@/contexts/ToastContext';
import { useConfirm } from '@/contexts/ConfirmDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, EmptyState, LoadingRows, PageContainer, StatCard } from '@/components/ui/page';
import { cn } from '@/lib/utils';

const aptDateYmd = (dateStr: string): string =>
  dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.slice(0, 10);

const parseYmd = (ymd: string) => {
  const [year, month, day] = ymd.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
};

const formatMoney = (amount: number) => `${amount.toLocaleString('tr-TR')} ₺`;

const istanbulHour = () =>
  Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Istanbul', hour: '2-digit', hour12: false }).format(new Date()));

const greeting = () => {
  const hour = istanbulHour();
  if (hour >= 5 && hour < 12) return 'Günaydın';
  if (hour >= 12 && hour < 18) return 'İyi günler';
  if (hour >= 18 && hour < 23) return 'İyi akşamlar';
  return 'İyi geceler';
};

const STATUS_BADGE: Record<AppointmentStatus, 'neutral' | 'success' | 'danger' | 'muted'> = {
  scheduled: 'neutral',
  attended: 'success',
  no_show: 'danger',
  cancelled: 'muted',
};

const STATUS_ACTIONS: { value: AppointmentStatus; label: string; icon: LucideIcon }[] = [
  { value: 'scheduled', label: 'Planlandı', icon: CircleDashed },
  { value: 'attended', label: 'Geldi', icon: Check },
  { value: 'no_show', label: 'Gelmedi', icon: UserX },
];

export const Today = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const [appointments, setAppointments] = useState<AppointmentWithClient[]>([]);
  const [upcoming, setUpcoming] = useState<AppointmentWithClient[]>([]);
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const loadAppointments = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [data, profile] = await Promise.all([getAllAppointments(), getProfile().catch(() => null)]);
      setAppointments(data);
      setDisplayName(profile?.displayName ?? '');
      setUpcoming(await getUpcomingAppointments(profile?.reminderHours ?? 24));
    } catch (error) {
      console.error('Error loading today appointments:', error);
      showToast('Randevular yüklenemedi.', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadAppointments();
  }, [loadAppointments]);

  const today = istanbulTodayYmd();
  const monthPrefix = today.slice(0, 7);

  const todayList = appointments
    .filter((apt) => aptDateYmd(apt.appointmentDate) === today)
    .sort((a, b) => (a.appointmentTime || '00:00').localeCompare(b.appointmentTime || '00:00'));
  const activeToday = todayList.filter((apt) => appointmentStatus(apt.status) !== 'cancelled');
  const attendedToday = todayList.filter((apt) => appointmentStatus(apt.status) === 'attended');

  const unpaidAll = appointments
    .filter(
      (apt) =>
        !appointmentPaid(apt.isPaid) &&
        appointmentStatus(apt.status) !== 'cancelled' &&
        aptDateYmd(apt.appointmentDate) <= today
    )
    .sort((a, b) => {
      const keyA = aptDateYmd(a.appointmentDate) + (a.appointmentTime || '00:00');
      const keyB = aptDateYmd(b.appointmentDate) + (b.appointmentTime || '00:00');
      return keyB.localeCompare(keyA);
    });
  const unpaidTotal = unpaidAll.reduce((sum, apt) => sum + appointmentAmount(apt), 0);

  const collectedThisMonth = appointments
    .filter((apt) => appointmentPaid(apt.isPaid) && aptDateYmd(apt.appointmentDate).startsWith(monthPrefix))
    .reduce((sum, apt) => sum + appointmentAmount(apt), 0);

  const nextSession = upcoming[0];
  const laterUpcoming = upcoming.filter((apt) => aptDateYmd(apt.appointmentDate) !== today);

  const dayLabel = (ymd: string) => {
    if (ymd === today) return 'Bugün';
    const tomorrow = new Date(parseYmd(today));
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (ymd === format(tomorrow, 'yyyy-MM-dd')) return 'Yarın';
    return format(parseYmd(ymd), 'd MMM', { locale: tr });
  };

  const handlePatch = async (apt: AppointmentWithClient, patch: UpdateAppointmentInput) => {
    const previous = { status: apt.status, isPaid: apt.isPaid };
    setUpdatingId(apt.id);
    setAppointments((current) =>
      current.map((item) =>
        item.id === apt.id
          ? {
              ...item,
              status: patch.status ?? item.status,
              isPaid: patch.isPaid === undefined ? item.isPaid : patch.isPaid ? 1 : 0,
            }
          : item
      )
    );
    try {
      await updateAppointment(apt.clientId, apt.id, patch);
      await loadAppointments(true);
    } catch (error: unknown) {
      setAppointments((current) => current.map((item) => (item.id === apt.id ? { ...item, ...previous } : item)));
      showToast(apiErrorMessage(error, 'Değişiklik kaydedilemedi.'), 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleCancel = async (apt: AppointmentWithClient) => {
    const ok = await confirm({
      title: 'Seansı iptal et',
      message: `${apt.clientName || 'Danışan'} · ${apt.appointmentTime || ''} seansı iptal edilsin mi? Saat boşalır, kayıt ve notlar durur.`,
      confirmLabel: 'İptal et',
      danger: true,
    });
    if (ok) void handlePatch(apt, { status: 'cancelled' });
  };

  const headingDate = format(parseYmd(today), 'd MMMM yyyy, EEEE', { locale: tr });
  const firstName = displayName.trim().split(/\s+/).slice(0, 2).join(' ');

  return (
    <PageContainer>
      <header className="mb-6">
        <p className="text-sm text-muted-foreground">{headingDate}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-[28px]">
          {greeting()}
          {firstName ? `, ${firstName}` : ''}
        </h1>
      </header>

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Özet">
        <StatCard
          icon={CalendarCheck2}
          label="Bugünkü seanslar"
          value={loading ? '–' : String(activeToday.length)}
          hint={loading ? 'Yükleniyor' : `${attendedToday.length} tamamlandı`}
        />
        <StatCard
          icon={Clock3}
          label="Sıradaki seans"
          value={loading ? '–' : nextSession ? nextSession.appointmentTime || '--:--' : 'Yok'}
          hint={
            nextSession
              ? `${dayLabel(aptDateYmd(nextSession.appointmentDate))} · ${nextSession.clientName || 'Danışan'}`
              : 'Yakın zamanda seans yok'
          }
        />
        <StatCard
          icon={Wallet}
          label="Bekleyen ödeme"
          value={loading ? '–' : formatMoney(unpaidTotal)}
          hint={`${unpaidAll.length} seans`}
          tone={unpaidTotal > 0 ? 'warning' : 'default'}
        />
        <StatCard
          icon={Banknote}
          label="Bu ay tahsilat"
          value={loading ? '–' : formatMoney(collectedThisMonth)}
          hint={format(parseYmd(today), 'MMMM yyyy', { locale: tr })}
          tone="success"
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Bugünün seansları</CardTitle>
              <CardDescription className="mt-1">Durumu ve ödemeyi buradan işaretleyin.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/takvim')}>
              <CalendarDays />
              Takvim
            </Button>
          </CardHeader>
          {loading ? (
            <LoadingRows />
          ) : todayList.length === 0 ? (
            <EmptyState icon={CalendarCheck2} title="Bugün seans yok" hint="Takvimden yeni randevu ekleyebilirsiniz." />
          ) : (
            <ul className="m-0 mt-4 list-none divide-y divide-border p-0">
              {todayList.map((apt) => {
                const status = appointmentStatus(apt.status);
                const paid = appointmentPaid(apt.isPaid);
                const cancelled = status === 'cancelled';
                const busy = updatingId === apt.id;
                return (
                  <li
                    key={apt.id}
                    className={cn('flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4', cancelled && 'opacity-60')}
                  >
                    <div className="w-12 shrink-0 text-[15px] font-semibold tabular-nums">{apt.appointmentTime || '--:--'}</div>
                    <button
                      type="button"
                      onClick={() => navigate(`/client/${apt.clientId}`)}
                      className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 border-0 bg-transparent p-0 text-left text-foreground [font-family:inherit]"
                    >
                      <Avatar name={apt.clientName} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium hover:underline">{apt.clientName || 'İsimsiz'}</span>
                        <span className="block truncate text-[13px] text-muted-foreground">
                          {sessionDurationLabel(apt.durationMinutes)}
                          {apt.title ? ` · ${apt.title}` : ''}
                          {apt.roomName ? ` · ${apt.roomName}` : ''}
                        </span>
                      </span>
                    </button>
                    <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
                      <Badge variant={STATUS_BADGE[status]}>{appointmentStatusLabel(status)}</Badge>
                      {cancelled ? null : paid ? (
                        <Badge variant="success">
                          <Check className="size-3" />
                          Ödendi
                        </Badge>
                      ) : (
                        <Button variant="success" size="sm" disabled={busy} onClick={() => void handlePatch(apt, { isPaid: true })}>
                          <Banknote />
                          Ödeme al
                        </Button>
                      )}
                      {status === 'scheduled' ? (
                        <Button variant="outline" size="sm" disabled={busy} onClick={() => void handlePatch(apt, { status: 'attended' })}>
                          <Check />
                          Geldi
                        </Button>
                      ) : null}
                      {apt.googleMeetLink ? (
                        <Button variant="ghost" size="icon-sm" asChild>
                          <a href={apt.googleMeetLink} target="_blank" rel="noreferrer" aria-label="Meet toplantısına katıl" title="Meet">
                            <Video />
                          </a>
                        </Button>
                      ) : null}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" disabled={busy} aria-label="Diğer işlemler">
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Durum</DropdownMenuLabel>
                          {STATUS_ACTIONS.map((action) => (
                            <DropdownMenuItem
                              key={action.value}
                              onSelect={() => void handlePatch(apt, { status: action.value })}
                              className={cn(status === action.value && 'font-semibold')}
                            >
                              <action.icon />
                              {action.label}
                              {status === action.value ? <Check className="ml-auto" /> : null}
                            </DropdownMenuItem>
                          ))}
                          {!cancelled ? (
                            <DropdownMenuItem destructive onSelect={() => void handleCancel(apt)}>
                              <X />
                              İptal et
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuSeparator />
                          {paid ? (
                            <DropdownMenuItem onSelect={() => void handlePatch(apt, { isPaid: false })}>
                              <Undo2 />
                              Ödemeyi geri al
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuItem onSelect={() => navigate(`/client/${apt.clientId}`)}>
                            <UserRound />
                            Danışan sayfası
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Ödenmemişler</CardTitle>
              <Button variant="ghost" size="sm" className="-mr-2 text-primary" onClick={() => navigate('/odemeler')}>
                Tümü
              </Button>
            </CardHeader>
            {loading ? (
              <LoadingRows />
            ) : unpaidAll.length === 0 ? (
              <EmptyState icon={Check} title="Bekleyen ödeme yok" />
            ) : (
              <ul className="m-0 mt-3 list-none divide-y divide-border p-0">
                {unpaidAll.slice(0, 6).map((apt) => (
                  <li key={apt.id} className="flex items-center gap-3 px-5 py-3">
                    <button
                      type="button"
                      onClick={() => navigate(`/client/${apt.clientId}`)}
                      className="min-w-0 flex-1 cursor-pointer border-0 bg-transparent p-0 text-left text-foreground [font-family:inherit]"
                    >
                      <span className="block truncate text-sm font-medium">{apt.clientName || 'İsimsiz'}</span>
                      <span className="block text-[13px] text-muted-foreground">
                        {dayLabel(aptDateYmd(apt.appointmentDate))} · {apt.appointmentTime || '--:--'}
                      </span>
                    </button>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">{formatMoney(appointmentAmount(apt))}</span>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      disabled={updatingId === apt.id}
                      onClick={() => void handlePatch(apt, { isPaid: true })}
                      aria-label={`${apt.clientName || 'Danışan'} ödemesini alındı olarak işaretle`}
                      title="Ödendi olarak işaretle"
                    >
                      <Check />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {!loading && laterUpcoming.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Yaklaşan</CardTitle>
                <CalendarClock className="size-4 text-muted-foreground" />
              </CardHeader>
              <ul className="m-0 mt-3 list-none divide-y divide-border p-0">
                {laterUpcoming.map((apt) => (
                  <li key={apt.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="w-14 shrink-0 text-[13px] font-medium text-muted-foreground">
                      {dayLabel(aptDateYmd(apt.appointmentDate))}
                    </span>
                    <span className="w-11 shrink-0 text-sm font-semibold tabular-nums">{apt.appointmentTime || '--:--'}</span>
                    <span className="min-w-0 flex-1 truncate text-sm">{apt.clientName || 'Danışan'}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      </div>
    </PageContainer>
  );
};

