import { Fragment, useCallback, useEffect, useState, type FormEvent } from 'react';
import { Banknote, Download, Hourglass, Plus, TrendingDown, Wallet, X } from 'lucide-react';
import { apiErrorMessage, deleteSharePayment, getClinicFeeReport, recordSharePayment } from '../services/api';
import type { ClinicFeeReport, FeeStatus, TherapistFee } from '../types';
import { useToast } from '../contexts/ToastContext';
import { downloadCsv, type CsvCell } from '../utils/csv';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FormError, Input } from '@/components/ui/input';
import { Avatar, LoadingRows, StatCard } from '@/components/ui/page';

const formatMoney = (amount: number) => `${amount.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺`;

const STATUS: Record<FeeStatus, { label: string; variant: 'neutral' | 'success' | 'warning' | 'danger' }> = {
  none: { label: 'Pay yok', variant: 'neutral' },
  paid: { label: 'Ödendi', variant: 'success' },
  partial: { label: 'Kısmi', variant: 'warning' },
  unpaid: { label: 'Ödenmedi', variant: 'danger' },
};

const todayIso = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

type Props = {
  year: number;
  month: number;
  monthLabel: string;
  canManagePayments: boolean;
};

/**
 * Klinik sahibi için oda ücreti raporu: her psikolog için oda payı, ödenen ve kalan. Psikologların
 * tahsilatı ve kazancı sunucudan hiç gelmez. Ödeme kayıtları seçili ayın payına sayılır.
 */
export const ClinicFeeReportSection = ({ year, month, monthLabel, canManagePayments }: Props) => {
  const { showToast } = useToast();
  const period = `${year}-${String(month + 1).padStart(2, '0')}`;
  const [report, setReport] = useState<ClinicFeeReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openUserId, setOpenUserId] = useState<number | null>(null);
  const [amount, setAmount] = useState('');
  const [paidOn, setPaidOn] = useState(todayIso());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setReport(await getClinicFeeReport(period));
      setError(null);
    } catch (err) {
      setError(apiErrorMessage(err, 'Oda ücreti raporu alınamadı.'));
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    setLoading(true);
    setOpenUserId(null);
    void load();
  }, [load]);

  const openForm = (row: TherapistFee) => {
    setOpenUserId(row.userId);
    setAmount(row.remaining > 0 ? String(row.remaining) : '');
    setPaidOn(todayIso());
    setNote('');
    setError(null);
  };

  const handleSubmit = async (e: FormEvent, row: TherapistFee) => {
    e.preventDefault();
    const value = Number(amount.replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0) {
      setError('Tutar sıfırdan büyük olmalı.');
      return;
    }
    setSaving(true);
    try {
      await recordSharePayment({ userId: row.userId, period, amount: value, paidOn, note: note.trim() || undefined });
      setOpenUserId(null);
      showToast('Ödeme kaydedildi.');
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Ödeme kaydedilemedi.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (paymentId: number) => {
    setError(null);
    try {
      await deleteSharePayment(paymentId);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Ödeme silinemedi.'));
    }
  };

  // Yalnızca sunucunun bu kullanıcıya zaten verdiği rakamlar: psikolog tahsilatı ve danışan bilgisi yok.
  const exportCsv = () => {
    if (!report) return;
    const rows: CsvCell[][] = [
      ['Rapor', 'Oda ücreti raporu'],
      ['Dönem', `${monthLabel} ${year}`],
      [],
      ['Oda geliri (₺)', report.totalOwed],
      ['Tahsil edilen (₺)', report.totalPaid],
      ['Kalan (₺)', report.totalRemaining],
      ['Toplam kalan borç, önceki aylar dahil (₺)', report.totalCumulativeRemaining],
      [],
      ['Psikolog', 'Seans', 'Oran (%)', 'Oda payı (₺)', 'Ödenen (₺)', 'Kalan (₺)', 'Toplam kalan (₺)', 'Durum'],
      ...report.therapists.map((row) => [
        row.name,
        row.sessions,
        row.percent,
        row.owed,
        row.paid,
        row.remaining,
        row.cumulativeRemaining,
        STATUS[row.status].label,
      ]),
    ];
    const payments = report.therapists.flatMap((row) => row.payments.map((payment) => ({ name: row.name, payment })));
    if (payments.length > 0) {
      rows.push(
        [],
        ['Ödeme kayıtları'],
        ['Psikolog', 'Tarih', 'Tutar (₺)', 'Not'],
        ...payments.map(({ name, payment }) => [name, payment.paidOn.slice(0, 10), payment.amount, payment.note])
      );
    }
    downloadCsv(`oda-ucreti-${period}.csv`, rows);
  };

  if (loading && !report) {
    return (
      <Card className="mb-6">
        <LoadingRows rows={4} />
      </Card>
    );
  }

  return (
    <section className="mb-6" aria-label="Oda ücretleri">
      {error ? (
        <div className="mb-3">
          <FormError>{error}</FormError>
        </div>
      ) : null}
      {report ? (
        <>
          <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              icon={Banknote}
              label={`${monthLabel} oda geliri`}
              value={formatMoney(report.totalOwed)}
              hint="Odalarda yapılan seanslardan doğan pay"
              tone="success"
            />
            <StatCard icon={Wallet} label="Tahsil edilen" value={formatMoney(report.totalPaid)} hint="Bu aya sayılan ödemeler" />
            <StatCard
              icon={Hourglass}
              label="Kalan"
              value={formatMoney(report.totalRemaining)}
              hint="Bu ay ödenmemiş kısım"
              tone={report.totalRemaining > 0 ? 'warning' : 'default'}
            />
            <StatCard
              icon={TrendingDown}
              label="Toplam kalan borç"
              value={formatMoney(report.totalCumulativeRemaining)}
              hint="Önceki aylar dahil"
              tone={report.totalCumulativeRemaining > 0 ? 'warning' : 'default'}
            />
          </div>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Psikolog bazında oda ücreti</CardTitle>
                <CardDescription className="mt-1">
                  Pay, odalarda yapılan iptal olmayan tüm seanslardan hesaplanır. Kendi seanslarınızdan pay alınmaz.
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={exportCsv} disabled={loading}>
                <Download />
                CSV indir
              </Button>
            </CardHeader>
            {report.therapists.length === 0 ? (
              <p className="m-0 px-5 pb-5 text-sm text-muted-foreground">Kliniğe bağlı başka psikolog yok.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="px-5 py-2 font-medium">Psikolog</th>
                      <th className="px-3 py-2 text-right font-medium">Seans</th>
                      <th className="px-3 py-2 text-right font-medium">Oran</th>
                      <th className="px-3 py-2 text-right font-medium">Oda payı</th>
                      <th className="px-3 py-2 text-right font-medium">Ödenen</th>
                      <th className="px-3 py-2 text-right font-medium">Kalan</th>
                      <th className="px-3 py-2 text-right font-medium">Toplam kalan</th>
                      <th className="px-3 py-2 font-medium">Durum</th>
                      {canManagePayments ? <th className="px-5 py-2" /> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {report.therapists.map((row) => (
                      <Fragment key={row.userId}>
                        <tr className="border-0 border-t border-solid border-border">
                          <td className="px-5 py-3">
                            <span className="flex items-center gap-2">
                              <Avatar name={row.name} />
                              <span className="font-medium">{row.name}</span>
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums">{row.sessions}</td>
                          <td className="px-3 py-3 text-right tabular-nums">%{row.percent}</td>
                          <td className="px-3 py-3 text-right font-medium tabular-nums">{formatMoney(row.owed)}</td>
                          <td className="px-3 py-3 text-right tabular-nums">{formatMoney(row.paid)}</td>
                          <td className="px-3 py-3 text-right tabular-nums">{formatMoney(row.remaining)}</td>
                          <td
                            className={`px-3 py-3 text-right tabular-nums ${row.cumulativeRemaining > 0 ? 'font-medium text-warning' : ''}`}
                          >
                            {formatMoney(row.cumulativeRemaining)}
                          </td>
                          <td className="px-3 py-3">
                            <Badge variant={STATUS[row.status].variant}>{STATUS[row.status].label}</Badge>
                          </td>
                          {canManagePayments ? (
                            <td className="px-5 py-3 text-right">
                              <Button variant="outline" size="sm" onClick={() => openForm(row)}>
                                <Plus />
                                Ödeme ekle
                              </Button>
                            </td>
                          ) : null}
                        </tr>
                        {row.payments.length > 0 || openUserId === row.userId ? (
                          <tr>
                            <td colSpan={canManagePayments ? 9 : 8} className="bg-muted/30 px-5 py-3">
                              {row.payments.length > 0 ? (
                                <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[13px]">
                                  {row.payments.map((payment) => (
                                    <li key={payment.id} className="flex items-center gap-3">
                                      <span className="tabular-nums text-muted-foreground">
                                        {new Date(payment.paidOn).toLocaleDateString('tr-TR')}
                                      </span>
                                      <span className="font-medium tabular-nums">{formatMoney(payment.amount)}</span>
                                      {payment.note ? <span className="text-muted-foreground">{payment.note}</span> : null}
                                      {canManagePayments ? (
                                        <Button
                                          variant="ghost"
                                          size="icon-sm"
                                          onClick={() => void handleDelete(payment.id)}
                                          aria-label="Ödeme kaydını sil"
                                        >
                                          <X />
                                        </Button>
                                      ) : null}
                                    </li>
                                  ))}
                                </ul>
                              ) : null}
                              {openUserId === row.userId ? (
                                <form
                                  onSubmit={(e) => void handleSubmit(e, row)}
                                  className={`flex flex-wrap items-end gap-3 ${row.payments.length > 0 ? 'mt-3' : ''}`}
                                >
                                  <Field label="Tutar (₺)" htmlFor={`fee-amount-${row.userId}`} className="w-36">
                                    <Input
                                      id={`fee-amount-${row.userId}`}
                                      inputMode="decimal"
                                      value={amount}
                                      onChange={(e) => setAmount(e.target.value)}
                                      autoFocus
                                      required
                                    />
                                  </Field>
                                  <Field label="Ödeme tarihi" htmlFor={`fee-date-${row.userId}`}>
                                    <Input
                                      id={`fee-date-${row.userId}`}
                                      type="date"
                                      value={paidOn}
                                      onChange={(e) => setPaidOn(e.target.value)}
                                      required
                                    />
                                  </Field>
                                  <Field label="Not" htmlFor={`fee-note-${row.userId}`} className="min-w-40 flex-1">
                                    <Input
                                      id={`fee-note-${row.userId}`}
                                      value={note}
                                      onChange={(e) => setNote(e.target.value)}
                                      placeholder="Havale, nakit…"
                                      maxLength={200}
                                    />
                                  </Field>
                                  <Button type="submit" disabled={saving}>
                                    Kaydet
                                  </Button>
                                  <Button type="button" variant="ghost" onClick={() => setOpenUserId(null)}>
                                    Vazgeç
                                  </Button>
                                </form>
                              ) : null}
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      ) : null}
    </section>
  );
};
