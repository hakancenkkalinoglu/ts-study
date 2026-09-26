import { useEffect, useState } from 'react';
import { Building2, Hourglass, Wallet } from 'lucide-react';
import { apiErrorMessage, getMyEarningsAll } from '../services/api';
import { useClinics } from '../contexts/ClinicContext';
import type { MyClinicEarnings, TherapistReport } from '../types';
import { Card } from '@/components/ui/card';
import { FormError } from '@/components/ui/input';
import { LoadingRows, StatCard } from '@/components/ui/page';

const formatMoney = (amount: number) => `${amount.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺`;

const pad = (value: number) => String(value).padStart(2, '0');

const monthRange = (year: number, month: number) => {
  const last = new Date(year, month + 1, 0).getDate();
  return { from: `${year}-${pad(month + 1)}-01`, to: `${year}-${pad(month + 1)}-${pad(last)}` };
};

/** Psikoloğun kendi satırı (rapor yalnızca çağıranın verisini içerir). */
const ownRow = (entry: MyClinicEarnings): TherapistReport | undefined => entry.report.therapists[0];

type Props = {
  year: number;
  month: number;
  monthLabel: string;
  /** 'all': tüm klinikler (klinik klinik ve toplam), sayı: yalnızca o klinik, 0: klinik dışı (klinik payı yok). */
  filter: 'all' | number;
  /** Yüklenen raporlar (kurucu olunan klinikler ve filtre dışı olanlar hariç); CSV dışa aktarma için üst sayfa kullanır. */
  onReport?: (entries: MyClinicEarnings[]) => void;
};

const EarningsCards = ({
  mine,
  monthLabel,
  percentHint,
}: {
  mine: Pick<TherapistReport, 'netAmount' | 'paidAmount' | 'clinicShare' | 'sharePaid' | 'shareRemaining' | 'sessions'>;
  monthLabel: string;
  percentHint?: string;
}) => (
  <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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
      hint={`${percentHint ? `${percentHint} · ` : ''}${mine.sessions} oda seansı`}
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

/**
 * Klinik üyesi psikoloğun kendi kazancı ve oda payı durumu. Kurucu olunan klinikte gösterilmez: kurucu
 * kendi seanslarından pay ödemez, kişisel rakamları zaten sayfanın geri kalanında. Birden fazla klinikte
 * her klinik kendi oranıyla ayrı hesaplanır, "tüm klinikler" görünümünde altta toplamları gösterilir.
 */
export const ClinicEarnings = ({ year, month, monthLabel, filter, onReport }: Props) => {
  const { clinics } = useClinics();
  const [entries, setEntries] = useState<MyClinicEarnings[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      onReport?.([]); // ay değişince eski ayın rakamı yenisi gelene kadar dışa aktarmaya girmesin
      try {
        const { from, to } = monthRange(year, month);
        const all = await getMyEarningsAll(from, to);
        if (cancelled) return;
        const shown = all.filter((entry) => {
          const clinic = clinics.find((item) => item.id === entry.clinicId);
          if (!clinic || clinic.role === 'owner') return false;
          return filter === 'all' || filter === entry.clinicId;
        });
        setEntries(shown);
        onReport?.(shown);
      } catch (err) {
        if (!cancelled) {
          setError(apiErrorMessage(err, 'Klinik payı bilgisi alınamadı.'));
          onReport?.([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [year, month, filter, clinics, onReport]);

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

  const rows = entries.flatMap((entry) => {
    const mine = ownRow(entry);
    return mine ? [{ entry, mine }] : [];
  });
  if (rows.length === 0) return null;

  const showNames = clinics.length > 1;
  const total = rows.reduce(
    (sum, { mine }) => ({
      netAmount: sum.netAmount + mine.netAmount,
      paidAmount: sum.paidAmount + mine.paidAmount,
      clinicShare: sum.clinicShare + mine.clinicShare,
      sharePaid: sum.sharePaid + mine.sharePaid,
      shareRemaining: sum.shareRemaining + mine.shareRemaining,
      sessions: sum.sessions + mine.sessions,
    }),
    { netAmount: 0, paidAmount: 0, clinicShare: 0, sharePaid: 0, shareRemaining: 0, sessions: 0 }
  );

  return (
    <div className="mb-6 flex flex-col gap-4" aria-label="Klinik payı">
      {rows.map(({ entry, mine }) => (
        <div key={entry.clinicId}>
          {showNames ? <h2 className="m-0 mb-2 text-sm font-semibold">{entry.clinicName}</h2> : null}
          <EarningsCards mine={mine} monthLabel={monthLabel} percentHint={`Oran %${mine.currentPercent}`} />
        </div>
      ))}
      {rows.length > 1 ? (
        <div>
          <h2 className="m-0 mb-2 text-sm font-semibold">Tüm klinikler toplamı</h2>
          <EarningsCards mine={total} monthLabel={monthLabel} />
        </div>
      ) : null}
    </div>
  );
};
