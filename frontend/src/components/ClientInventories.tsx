import { useEffect, useState, type FormEvent } from 'react';
import {
  apiErrorMessage,
  getClientInventoryResults,
  getInventory,
  listInventories,
  submitClientInventory,
} from '../services/api';
import type { InventoryDetail, InventoryResult, InventorySummary } from '../types';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

const SCALE = [
  { value: 0, label: 'Hiç' },
  { value: 1, label: 'Birkaç gün' },
  { value: 2, label: 'Haftanın yarısından fazla' },
  { value: 3, label: 'Hemen her gün' },
];

export const ClientInventories = ({ clientId }: { clientId: number }) => {
  const [catalog, setCatalog] = useState<InventorySummary[]>([]);
  const [results, setResults] = useState<InventoryResult[]>([]);
  const [selectedId, setSelectedId] = useState<number>(0);
  const [detail, setDetail] = useState<InventoryDetail | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const [list, history] = await Promise.all([listInventories(), getClientInventoryResults(clientId)]);
      setCatalog(list);
      setResults(history);
      setError(null);
    } catch (err) {
      setError(apiErrorMessage(err, 'Ölçekler yüklenemedi.'));
    }
  };

  useEffect(() => {
    void load();
  }, [clientId]);

  const handleSelect = async (id: number) => {
    setSelectedId(id);
    if (!id) {
      setDetail(null);
      return;
    }
    try {
      const data = await getInventory(id);
      setDetail(data);
      setAnswers(data.items.map(() => 0));
    } catch (err) {
      setError(apiErrorMessage(err, 'Ölçek açılamadı.'));
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    try {
      await submitClientInventory(clientId, selectedId, answers);
      setDetail(null);
      setSelectedId(0);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Ölçek kaydedilemedi.'));
    }
  };

  return (
    <div className="client-info-card">
      <h2>Ölçekler</h2>
      <p className="clinic-lead">PHQ-9 ve GAD-7 tarama ölçekleridir; tanı koymaz.</p>
      {error ? <p className="today-error">{error}</p> : null}
      <label htmlFor="inventory-select">Ölçek seç</label>
      <select
        id="inventory-select"
        value={selectedId}
        onChange={(e) => void handleSelect(Number(e.target.value))}
      >
        <option value={0}>Seçin</option>
        {catalog.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
      {detail ? (
        <form className="note-form" onSubmit={handleSubmit}>
          <p>{detail.description}</p>
          {detail.items.map((item, index) => (
            <fieldset key={item.id} className="form-group">
              <legend>
                {item.sortOrder}. {item.prompt}
              </legend>
              {SCALE.map((option) => (
                <label key={option.value} className="login-kvkk">
                  <input
                    type="radio"
                    name={`inv-${item.id}`}
                    checked={answers[index] === option.value}
                    onChange={() =>
                      setAnswers((current) => current.map((value, i) => (i === index ? option.value : value)))
                    }
                  />
                  {option.label}
                </label>
              ))}
            </fieldset>
          ))}
          <button type="submit" className="submit-button">
            Skoru kaydet
          </button>
        </form>
      ) : null}
      <ul className="clinic-list">
        {results.map((row) => (
          <li key={row.id}>
            <span>
              {row.inventoryName}: {row.score}/{row.maxScore} · {row.interpretation} ·{' '}
              {format(new Date(row.createdAt), 'd MMM yyyy', { locale: tr })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};
