import { useEffect, useState } from 'react';
import { Building2, Hourglass, Wallet } from 'lucide-react';
import { apiErrorMessage, getMyClinic, getMyEarnings } from '../services/api';
import type { ClinicReport } from '../types';
import { Card } from '@/components/ui/card';
import { FormError } from '@/components/ui/input';
import { LoadingRows, StatCard } from '@/components/ui/page';

const formatMoney = (amount: number) => `${amount.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺`;

const pad = (value: number) => String(value).padStart(2, '0');

const monthRange = (year: number, month: number) => {
  const last = new Date(year, month + 1, 0).getDate();
  return { from: `${year}-${pad(month + 1)}-01`, to: `${year}-${pad(month + 1)}-${pad(last)}` };
};

type Props = {
  year: number;
  month: number;
  monthLabel: string;
};

/**
 * Klinik üyesi psikoloğun kendi kazancı ve oda payı durumu. Klinikte olmayanlarda ve kurucuda
 * gösterilmez: kurucu kendi seanslarından pay ödemez, kişisel rakamları zaten sayfanın geri kalanında.
 */
export const ClinicEarnings = ({ year, month, monthLabel }: Props) => {
  const [report, setReport] = useState<ClinicReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const clinic = await getMyClinic();
        if (cancelled) return;
        if (!clinic || clinic.role === 'owner') {
          setReport(null);
          return;
        }
        const { from, to } = monthRange(year, month);
        const data = await getMyEarnings(from, to);
        if (!cancelled) setReport(data);
      } catch (err) {
        if (!cancelled) setError(apiErrorMessage(err, 'Klinik payı bilgisi alınamadı.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [year, month]);

  if (loading) {
    return (
      <Card className="mb-6">
        <LoadingRows rows={2} />
      </Card>
    );
  }

  if (error) {
    return (
      <div className="mb-6">
        <FormError>{error}</FormError>
      </div>
    );
  }

  const mine = report?.therapists[0];
  if (!report || !mine) return null;

  return (
    <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Klinik payı">
      <StatCard
        icon={Wallet}
        label={`${monthLabel} net kazancınız`}
        value={formatMoney(mine.netAmount)}
        hint={`Tahsilat ${formatMoney(mine.paidAmount)} − oda payı`}
        tone="success"
      />
      <StatCard
        icon={Building2}
        label="Oda payı (kliniğe)"
        value={formatMoney(mine.clinicShare)}
        hint={`Oran %${mine.currentPercent} · ${mine.sessions} oda seansı`}
      />
      <StatCard icon={Wallet} label="Kliniğe ödenen" value={formatMoney(mine.sharePaid)} hint="Bu aya sayılan ödemeler" />
      <StatCard
        icon={Hourglass}
        label="Kliniğe kalan"
        value={formatMoney(mine.shareRemaining)}
        hint="Bu ay ödenmemiş oda payı"
        tone={mine.shareRemaining > 0 ? 'warning' : 'default'}
      />
    </section>
  );
};
