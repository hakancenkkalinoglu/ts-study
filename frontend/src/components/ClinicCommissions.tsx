import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Percent } from 'lucide-react';
import {
  apiErrorMessage,
  applyCommissionToAll,
  getCommissions,
  setDefaultCommission,
  setMemberCommission,
} from '../services/api';
import type { CommissionOverview } from '../types';
import { useToast } from '../contexts/ToastContext';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FormError, Input } from '@/components/ui/input';
import { Avatar } from '@/components/ui/page';
import { Badge } from '@/components/ui/badge';

const parsePercent = (value: string): number | null => {
  const number = Number(value.replace(',', '.'));
  return value.trim() !== '' && Number.isFinite(number) && number >= 0 && number <= 100 ? number : null;
};

/**
 * Klinik payı yüzdeleri: klinik varsayılanı, psikolog başına istisna ve "herkese uygula".
 * Değişiklik seçilen tarihten itibaren geçerli olur; geçmiş seanslar eski oranla kalır.
 */
export const ClinicCommissions = () => {
  const { showToast } = useToast();
  const [overview, setOverview] = useState<CommissionOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [defaultValue, setDefaultValue] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [memberValues, setMemberValues] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);

  const apply = useCallback((data: CommissionOverview) => {
    setOverview(data);
    setDefaultValue(String(data.defaultPercent));
    setMemberValues(Object.fromEntries(data.members.map((m) => [m.userId, String(m.percent)])));
  }, []);

  useEffect(() => {
    getCommissions()
      .then(apply)
      .catch((err) => setError(apiErrorMessage(err, 'Oranlar alınamadı.')));
  }, [apply]);

  const run = async (action: () => Promise<CommissionOverview>, done: string) => {
    setError(null);
    setSaving(true);
    try {
      apply(await action());
      showToast(done);
    } catch (err) {
      setError(apiErrorMessage(err, 'Oran kaydedilemedi.'));
    } finally {
      setSaving(false);
    }
  };

  const from = validFrom || undefined;

  const handleDefault = (e: FormEvent) => {
    e.preventDefault();
    const percent = parsePercent(defaultValue);
    if (percent == null) return setError('Yüzde 0 ile 100 arasında olmalı.');
    void run(() => setDefaultCommission(percent, from), 'Varsayılan oran güncellendi.');
  };

  const handleApplyAll = () => {
    const percent = parsePercent(defaultValue);
    if (percent == null) return setError('Yüzde 0 ile 100 arasında olmalı.');
    void run(() => applyCommissionToAll(percent, from), 'Oran herkese uygulandı.');
  };

  const handleMember = (userId: number) => {
    const percent = parsePercent(memberValues[userId] ?? '');
    if (percent == null) return setError('Yüzde 0 ile 100 arasında olmalı.');
    void run(() => setMemberCommission(userId, percent, from), 'Psikolog oranı güncellendi.');
  };

  const handleReset = (userId: number) => {
    void run(() => setMemberCommission(userId, null, from), 'Varsayılan orana dönüldü.');
  };

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Klinik payı oranları</CardTitle>
          <CardDescription className="mt-1">
            Her seans ücretinden klinik payı olarak kesilir. Değişiklik seçtiğiniz tarihten itibaren geçerlidir.
          </CardDescription>
        </div>
        <Percent className="size-4 text-muted-foreground" />
      </CardHeader>
      {error ? (
        <div className="px-5 pt-3">
          <FormError>{error}</FormError>
        </div>
      ) : null}
      <form onSubmit={handleDefault} className="flex flex-wrap items-end gap-3 px-5 pt-3">
        <Field label="Varsayılan oran (%)" htmlFor="commission-default" className="w-40">
          <Input
            id="commission-default"
            inputMode="decimal"
            value={defaultValue}
            onChange={(e) => setDefaultValue(e.target.value)}
          />
        </Field>
        <Field label="Geçerlilik tarihi" htmlFor="commission-from" hint="Boşsa bugün">
          <Input id="commission-from" type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
        </Field>
        <Button type="submit" variant="outline" disabled={saving}>
          Varsayılanı kaydet
        </Button>
        <Button type="button" variant="outline" disabled={saving} onClick={handleApplyAll}>
          Herkese uygula
        </Button>
      </form>
      <p className="m-0 px-5 pt-2 text-xs text-muted-foreground">
        "Herkese uygula" varsayılanı günceller ve psikologlara özel oranları kaldırır. Kendi seanslarınızdan pay alınmaz.
      </p>
      <ul className="m-0 mt-3 list-none divide-y divide-border p-0 pb-2">
        {overview?.members.map((member) => (
          <li key={member.userId} className="flex flex-wrap items-center gap-3 px-5 py-3">
            <Avatar name={member.name} />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{member.name}</span>
            {member.custom ? <Badge variant="warning">Özel oran</Badge> : <Badge>Varsayılan</Badge>}
            <Input
              className="w-24"
              inputMode="decimal"
              aria-label={`${member.name} oranı (%)`}
              value={memberValues[member.userId] ?? ''}
              onChange={(e) => setMemberValues((prev) => ({ ...prev, [member.userId]: e.target.value }))}
            />
            <Button size="sm" variant="outline" disabled={saving} onClick={() => handleMember(member.userId)}>
              Kaydet
            </Button>
            {member.custom ? (
              <Button size="sm" variant="ghost" disabled={saving} onClick={() => handleReset(member.userId)}>
                Varsayılana dön
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
};
