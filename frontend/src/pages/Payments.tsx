import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Check, Loader2, Undo2, Wallet } from 'lucide-react';
import { getAllAppointments, updateAppointment, apiErrorMessage } from '../services/api';
import type { AppointmentWithClient } from '../types';
import { appointmentAmount, appointmentPaid, appointmentStatus, appointmentStatusLabel } from '../types';
import { useToast } from '../contexts/ToastContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, EmptyState, LoadingRows, PageContainer, PageHeader } from '@/components/ui/page';
import { cn } from '@/lib/utils';

type PaymentTab = 'pending' | 'completed';

const formatMoney = (amount: number) => `${amount.toLocaleString('tr-TR')} ₺`;

const parseYmd = (dateStr: string) => {
  const part = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.slice(0, 10);
  const [year, month, day] = part.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
};

const STATUS_BADGE = {
  scheduled: 'neutral',
  attended: 'success',
  no_show: 'danger',
  cancelled: 'muted',
} as const;

export const Payments = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
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
    (apt) => !appointmentPaid(apt.isPaid) && appointmentStatus(apt.status) !== 'cancelled'
  );
  const completedAppointments = appointments.filter(
    (apt) => appointmentPaid(apt.isPaid) && appointmentStatus(apt.status) !== 'cancelled'
  );

  const handleTogglePayment = async (apt: AppointmentWithClient) => {
    const nextPaid = !appointmentPaid(apt.isPaid);
    try {
      setUpdatingId(apt.id);
      await updateAppointment(apt.clientId, apt.id, { isPaid: nextPaid });
      showToast(nextPaid ? 'Ödeme alındı olarak işaretlendi.' : 'Ödeme geri alındı.');
      loadAppointments();
    } catch (error) {
      console.error('Error updating payment status:', error);
      showToast(apiErrorMessage(error, 'Ödeme durumu güncellenirken bir hata oluştu.'), 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const displayList = activeTab === 'pending' ? pendingAppointments : completedAppointments;
  const sortedList = [...displayList].sort((a, b) =>
    (a.appointmentDate + (a.appointmentTime || '00:00')).localeCompare(b.appointmentDate + (b.appointmentTime || '00:00'))
  );
  const listTotal = sortedList.reduce((sum, apt) => sum + appointmentAmount(apt), 0);

  const tabs: { value: PaymentTab; label: string; count: number }[] = [
    { value: 'pending', label: 'Bekleyen', count: pendingAppointments.length },
    { value: 'completed', label: 'Tamamlanan', count: completedAppointments.length },
  ];

  const actionButton = (apt: AppointmentWithClient, compact = false) => {
    const paid = appointmentPaid(apt.isPaid);
    const busy = updatingId === apt.id;
    return (
      <Button
        variant={paid ? 'ghost' : 'success'}
        size="sm"
        onClick={() => handleTogglePayment(apt)}
        disabled={busy}
        className={cn(compact && 'w-full')}
      >
        {busy ? <Loader2 className="animate-spin" /> : paid ? <Undo2 /> : <Check />}
        {paid ? 'Geri al' : 'Ödeme alındı'}
      </Button>
    );
  };

  return (
    <PageContainer>
      <PageHeader title="Ödemeler" description="İptal edilenler hariç tüm seansların ödeme durumu." />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex w-full rounded-lg border border-solid bg-muted/60 p-1 sm:w-auto" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                'flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border-0 px-4 py-1.5 text-sm font-medium [font-family:inherit] transition-colors sm:flex-none',
                activeTab === tab.value ? 'bg-card text-foreground shadow-sm' : 'bg-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.label}
              <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">{tab.count}</span>
            </button>
          ))}
        </div>
        {!loading && sortedList.length > 0 ? (
          <p className="m-0 text-sm text-muted-foreground">
            Toplam <span className="font-semibold text-foreground">{formatMoney(listTotal)}</span>
          </p>
        ) : null}
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <LoadingRows rows={4} />
        ) : sortedList.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title={activeTab === 'pending' ? 'Bekleyen ödeme yok' : 'Tamamlanan ödeme yok'}
            hint={activeTab === 'pending' ? 'Tüm seansların ödemesi alınmış.' : 'Ödeme alındığında burada listelenir.'}
          />
        ) : (
          <>
            <table className="hidden w-full border-collapse text-sm md:table">
              <thead>
                <tr className="border-0 border-b border-solid bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Tarih</th>
                  <th className="px-5 py-3 font-medium">Danışan</th>
                  <th className="px-5 py-3 font-medium">Durum</th>
                  <th className="px-5 py-3 text-right font-medium">Tutar</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {sortedList.map((apt) => {
                  const status = appointmentStatus(apt.status);
                  return (
                    <tr key={apt.id} className="border-0 border-b border-solid last:border-b-0 hover:bg-accent/40">
                      <td className="whitespace-nowrap px-5 py-3">
                        <div className="font-medium">{format(parseYmd(apt.appointmentDate), 'd MMM yyyy', { locale: tr })}</div>
                        <div className="text-[13px] text-muted-foreground">{apt.appointmentTime || '–'}</div>
                      </td>
                      <td className="px-5 py-3">
                        <button
                          type="button"
                          onClick={() => navigate(`/client/${apt.clientId}`)}
                          className="flex cursor-pointer items-center gap-2.5 border-0 bg-transparent p-0 text-left text-foreground [font-family:inherit] hover:underline"
                        >
                          <Avatar name={apt.clientName} className="size-8 text-xs" />
                          <span>
                            <span className="block font-medium">{apt.clientName || 'İsimsiz'}</span>
                            {apt.title ? <span className="block text-[13px] text-muted-foreground">{apt.title}</span> : null}
                          </span>
                        </button>
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant={STATUS_BADGE[status]}>{appointmentStatusLabel(status)}</Badge>
                      </td>
                      <td className="px-5 py-3 text-right font-semibold tabular-nums">{formatMoney(appointmentAmount(apt))}</td>
                      <td className="px-5 py-3 text-right">{actionButton(apt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <ul className="m-0 list-none divide-y divide-border p-0 md:hidden">
              {sortedList.map((apt) => {
                const status = appointmentStatus(apt.status);
                return (
                  <li key={apt.id} className="flex flex-col gap-3 px-4 py-4">
                    <div className="flex items-start gap-3">
                      <Avatar name={apt.clientName} />
                      <button
                        type="button"
                        onClick={() => navigate(`/client/${apt.clientId}`)}
                        className="min-w-0 flex-1 cursor-pointer border-0 bg-transparent p-0 text-left text-foreground [font-family:inherit]"
                      >
                        <span className="block truncate text-sm font-medium">{apt.clientName || 'İsimsiz'}</span>
                        <span className="block text-[13px] text-muted-foreground">
                          {format(parseYmd(apt.appointmentDate), 'd MMM yyyy', { locale: tr })} · {apt.appointmentTime || '–'}
                        </span>
                      </button>
                      <div className="text-right">
                        <div className="text-sm font-semibold tabular-nums">{formatMoney(appointmentAmount(apt))}</div>
                        <Badge variant={STATUS_BADGE[status]} className="mt-1">
                          {appointmentStatusLabel(status)}
                        </Badge>
                      </div>
                    </div>
                    {actionButton(apt, true)}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Card>
    </PageContainer>
  );
};
