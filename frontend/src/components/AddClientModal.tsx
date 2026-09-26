import { useEffect, useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { apiErrorMessage, createClient } from '../services/api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field, FormError, Input, NativeSelect } from '@/components/ui/input';
import { useClinics } from '../contexts/ClinicContext';

interface AddClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const emptyForm = () => ({
  email: '',
  name: '',
  birthDate: '',
  agreedFee: 2000,
  phone: '',
  emergencyName: '',
  emergencyPhone: '',
});

export const AddClientModal = ({ isOpen, onClose, onSuccess }: AddClientModalProps) => {
  const { clinics, activeClinic } = useClinics();
  const [formData, setFormData] = useState(emptyForm);
  // Danışan tek kliniğe ait; 0 = kişisel (klinik yok). Kliniği olmayan psikolog bu alanı görmez.
  const [clinicId, setClinicId] = useState<number>(activeClinic?.id ?? 0);

  useEffect(() => {
    if (isOpen) setClinicId(activeClinic?.id ?? 0);
  }, [isOpen, activeClinic?.id]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!formData.name.trim()) {
      setError('Ad soyad zorunludur.');
      return;
    }
    setLoading(true);
    try {
      await createClient({
        name: formData.name.trim(),
        email: formData.email.trim() || undefined,
        birthDate: formData.birthDate || undefined,
        agreedFee: formData.agreedFee,
        phone: formData.phone.trim() || undefined,
        emergencyName: formData.emergencyName.trim() || undefined,
        emergencyPhone: formData.emergencyPhone.trim() || undefined,
        clinicId: clinics.length > 0 ? clinicId : undefined,
      });
      onSuccess();
      setFormData(emptyForm());
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, 'Danışan eklenirken bir hata oluştu.'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const update = (patch: Partial<ReturnType<typeof emptyForm>>) => setFormData((prev) => ({ ...prev, ...patch }));

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent title="Yeni danışan" description="Sadece ad soyad zorunlu; diğer bilgileri sonra da ekleyebilirsiniz.">
        <form onSubmit={handleSubmit}>
          <DialogBody>
            <Field label="Ad soyad *" htmlFor="client-name">
              <Input id="client-name" required value={formData.name} onChange={(e) => update({ name: e.target.value })} autoFocus />
            </Field>
            {clinics.length > 0 ? (
              <Field
                label="Klinik"
                htmlFor="client-clinic"
                hint="Danışan tek kliniğe ait olur; randevuları o klinikte görünür. Sonradan değiştirilebilir."
              >
                <NativeSelect id="client-clinic" value={clinicId} onChange={(e) => setClinicId(Number(e.target.value))}>
                  {clinics.map((clinic) => (
                    <option key={clinic.id} value={clinic.id}>
                      {clinic.name}
                    </option>
                  ))}
                  <option value={0}>Kişisel (klinik yok)</option>
                </NativeSelect>
              </Field>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="E-posta" htmlFor="client-email">
                <Input id="client-email" type="email" value={formData.email} onChange={(e) => update({ email: e.target.value })} />
              </Field>
              <Field label="Telefon" htmlFor="client-phone">
                <Input
                  id="client-phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => update({ phone: e.target.value })}
                  placeholder="05xx xxx xx xx"
                />
              </Field>
              <Field label="Doğum tarihi" htmlFor="client-birthDate">
                <Input id="client-birthDate" type="date" value={formData.birthDate} onChange={(e) => update({ birthDate: e.target.value })} />
              </Field>
              <Field label="Anlaşılan ücret (₺)" htmlFor="client-fee">
                <Input
                  id="client-fee"
                  type="number"
                  min={0}
                  step={100}
                  value={formData.agreedFee}
                  onChange={(e) => update({ agreedFee: Number(e.target.value) || 0 })}
                />
              </Field>
            </div>
            <div className="rounded-lg border border-solid bg-muted/40 p-4">
              <p className="m-0 mb-3 text-[13px] font-medium text-muted-foreground">Acil durumda aranacak kişi</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Ad soyad" htmlFor="client-emergencyName">
                  <Input
                    id="client-emergencyName"
                    value={formData.emergencyName}
                    onChange={(e) => update({ emergencyName: e.target.value })}
                  />
                </Field>
                <Field label="Telefon" htmlFor="client-emergencyPhone">
                  <Input
                    id="client-emergencyPhone"
                    type="tel"
                    value={formData.emergencyPhone}
                    onChange={(e) => update({ emergencyPhone: e.target.value })}
                    placeholder="05xx xxx xx xx"
                  />
                </Field>
              </div>
            </div>
            <FormError>{error}</FormError>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Vazgeç
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : null}
              {loading ? 'Ekleniyor...' : 'Danışanı ekle'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
