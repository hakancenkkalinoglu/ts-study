import { useEffect, useState, type FormEvent } from 'react';
import {
  apiErrorMessage,
  consumeClientPackage,
  createClientPackage,
  deleteClientPackage,
  getClientPackages,
} from '../services/api';
import type { SessionPackage } from '../types';

export const SessionPackages = ({ clientId }: { clientId: number }) => {
  const [packs, setPacks] = useState<SessionPackage[]>([]);
  const [title, setTitle] = useState('Seans paketi');
  const [total, setTotal] = useState(8);
  const [prepaid, setPrepaid] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setPacks(await getClientPackages(clientId));
      setError(null);
    } catch (err) {
      setError(apiErrorMessage(err, 'Paketler yüklenemedi.'));
    }
  };

  useEffect(() => {
    void load();
  }, [clientId]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await createClientPackage(clientId, { title, totalSessions: total, prepaidAmount: prepaid });
      setTitle('Seans paketi');
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Paket eklenemedi.'));
    }
  };

  return (
    <div className="client-info-card">
      <h2>Seans paketleri</h2>
      {error ? <p className="today-error">{error}</p> : null}
      <ul className="clinic-list">
        {packs.map((pack) => (
          <li key={pack.id}>
            <span>
              {pack.title} · {pack.remainingSessions}/{pack.totalSessions} kalan
              {pack.prepaidAmount ? ` · ${pack.prepaidAmount.toLocaleString('tr-TR')} ₺` : ''}
            </span>
            {pack.remainingSessions > 0 ? (
              <button type="button" className="clinic-link" onClick={() => consumeClientPackage(clientId, pack.id).then(load)}>
                Bir seans düş
              </button>
            ) : null}
            <button type="button" className="clinic-link" onClick={() => deleteClientPackage(clientId, pack.id).then(load)}>
              Sil
            </button>
          </li>
        ))}
      </ul>
      <form className="clinic-inline-form" onSubmit={handleCreate}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Paket adı" required />
        <input
          type="number"
          min={1}
          max={100}
          value={total}
          onChange={(e) => setTotal(Number(e.target.value))}
          aria-label="Toplam seans"
        />
        <input
          type="number"
          min={0}
          value={prepaid}
          onChange={(e) => setPrepaid(Number(e.target.value))}
          aria-label="Peşin tutar"
        />
        <button type="submit" className="clinic-primary">
          Paket ekle
        </button>
      </form>
    </div>
  );
};
