import { useState, useEffect, useRef, useCallback, type FormEvent } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import { apiErrorMessage, createAppointment, getAppointmentById, getClients, getClinicRooms } from '../services/api';
import type { Client, AppointmentWithClient, ClinicRoom } from '../types';
import { sessionDuration, sessionDurationOptions } from '../types';
import { istanbulTodayYmd } from '../utils/dates';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field, FormError, Input, NativeSelect } from '@/components/ui/input';
import { Avatar } from '@/components/ui/page';

interface AddAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (createdAppointment?: AppointmentWithClient | null) => void;
  initialDate?: string;
  initialTime?: string;
  initialDuration?: number;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

export const AddAppointmentModal = ({
  isOpen,
  onClose,
  onSuccess,
  initialDate,
  initialTime,
  initialDuration,
}: AddAppointmentModalProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [searching, setSearching] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [formData, setFormData] = useState({
    clientId: 0,
    selectedClientName: '',
    appointmentDate: initialDate || istanbulTodayYmd(),
    appointmentTime: initialTime || '09:00',
    title: '',
    roomId: 0,
    durationMinutes: 50,
  });
  const [rooms, setRooms] = useState<ClinicRoom[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debouncedSearch = useDebounce(searchTerm, 300);

  const fetchClients = useCallback(async (term: string) => {
    setSearching(true);
    try {
      const data = await getClients(term.trim() || undefined);
      setClients(data);
    } catch {
      setClients([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (!dropdownOpen) return;
    if (debouncedSearch.trim().length >= 2) {
      fetchClients(debouncedSearch);
    } else {
      setClients([]);
    }
  }, [debouncedSearch, dropdownOpen, fetchClients]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setDropdownOpen(false);
      setClients([]);
      setError(null);
      getClinicRooms()
        .then(setRooms)
        .catch(() => setRooms([]));
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setFormData((prev) => ({
      ...prev,
      appointmentDate: initialDate || prev.appointmentDate,
      appointmentTime: initialTime || '09:00',
      durationMinutes: sessionDuration(initialDuration ?? 50),
    }));
  }, [isOpen, initialDate, initialTime, initialDuration]);

  const handleSelectClient = (client: Client) => {
    setFormData((prev) => ({
      ...prev,
      clientId: client.id,
      selectedClientName: client.name || client.email || 'İsimsiz',
    }));
    setSearchTerm('');
    setDropdownOpen(false);
  };

  const handleClearClient = () => {
    setFormData((prev) => ({ ...prev, clientId: 0, selectedClientName: '' }));
    setSearchTerm('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!formData.clientId) {
      setError('Lütfen bir danışan seçin.');
      return;
    }
    setLoading(true);
    try {
      const result = await createAppointment({
        clientId: formData.clientId,
        appointmentDate: formData.appointmentDate,
        appointmentTime: formData.appointmentTime,
        title: formData.title || undefined,
        roomId: formData.roomId || undefined,
        durationMinutes: sessionDuration(formData.durationMinutes),
      });
      const createdAppointment = await getAppointmentById(result.id);
      setFormData({
        clientId: 0,
        selectedClientName: '',
        appointmentDate: istanbulTodayYmd(),
        appointmentTime: '09:00',
        title: '',
        roomId: 0,
        durationMinutes: 50,
      });
      setSearchTerm('');
      onSuccess(createdAppointment);
    } catch (err) {
      setError(apiErrorMessage(err, 'Randevu eklenirken bir hata oluştu.'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent title="Yeni randevu">
        <form onSubmit={handleSubmit}>
          <DialogBody>
            <div className="flex flex-col gap-1.5" ref={dropdownRef}>
              <label htmlFor="client-search" className="text-[13px] font-medium">
                Danışan *
              </label>
              {formData.clientId ? (
                <div className="flex h-10 items-center gap-2.5 rounded-md border border-solid border-input bg-accent/40 pl-1.5 pr-1">
                  <Avatar name={formData.selectedClientName} className="size-7 text-[11px]" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{formData.selectedClientName}</span>
                  <Button type="button" variant="ghost" size="icon-sm" onClick={handleClearClient} aria-label="Danışanı değiştir">
                    <X />
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="client-search"
                    placeholder="Ad veya e-posta ile ara..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setDropdownOpen(true);
                    }}
                    onFocus={() => setDropdownOpen(true)}
                    autoComplete="off"
                    className="pl-9"
                    autoFocus
                  />
                  {dropdownOpen ? (
                    <div className="absolute inset-x-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-lg border border-solid bg-popover p-1 shadow-lg">
                      {searching ? (
                        <div className="flex items-center gap-2 px-3 py-2.5 text-[13px] text-muted-foreground">
                          <Loader2 className="size-3.5 animate-spin" />
                          Aranıyor...
                        </div>
                      ) : clients.length === 0 ? (
                        <div className="px-3 py-2.5 text-[13px] text-muted-foreground">
                          {searchTerm.trim().length < 2 ? 'En az 2 harf yazın' : 'Sonuç bulunamadı'}
                        </div>
                      ) : (
                        clients.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            className="flex w-full cursor-pointer items-center gap-2.5 rounded-md border-0 bg-transparent px-2 py-2 text-left text-foreground [font-family:inherit] hover:bg-accent"
                            onClick={() => handleSelectClient(c)}
                          >
                            <Avatar name={c.name || c.email} className="size-7 text-[11px]" />
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium">{c.name || c.email || 'İsimsiz'}</span>
                              {c.email && c.name ? (
                                <span className="block truncate text-xs text-muted-foreground">{c.email}</span>
                              ) : null}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field label="Tarih *" htmlFor="appointmentDate" className="col-span-2 sm:col-span-1">
                <Input
                  type="date"
                  id="appointmentDate"
                  required
                  value={formData.appointmentDate}
                  onChange={(e) => setFormData({ ...formData, appointmentDate: e.target.value })}
                />
              </Field>
              <Field label="Saat *" htmlFor="appointmentTime">
                <Input
                  type="time"
                  id="appointmentTime"
                  required
                  value={formData.appointmentTime}
                  onChange={(e) => setFormData({ ...formData, appointmentTime: e.target.value })}
                />
              </Field>
              <Field label="Süre *" htmlFor="durationMinutes">
                <NativeSelect
                  id="durationMinutes"
                  value={formData.durationMinutes}
                  onChange={(e) => setFormData({ ...formData, durationMinutes: sessionDuration(Number(e.target.value)) })}
                >
                  {sessionDurationOptions(formData.durationMinutes).map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </div>
            {rooms.length > 0 ? (
              <Field label="Oda" htmlFor="roomId">
                <NativeSelect
                  id="roomId"
                  value={formData.roomId}
                  onChange={(e) => setFormData({ ...formData, roomId: Number(e.target.value) })}
                >
                  <option value={0}>Seçilmedi</option>
                  {rooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            ) : null}
            <Field label="Başlık" htmlFor="title" hint="Takvimde danışan adının yanında görünür.">
              <Input
                id="title"
                placeholder="Örn. İlk görüşme"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </Field>
            <FormError>{error}</FormError>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Vazgeç
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : null}
              {loading ? 'Ekleniyor...' : 'Randevuyu ekle'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
