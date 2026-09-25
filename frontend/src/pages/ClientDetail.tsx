import { useState, useEffect, useCallback, type FormEvent, type ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
  ArrowLeft,
  CalendarPlus,
  Check,
  ChevronDown,
  ClipboardList,
  FileText,
  Loader2,
  Mail,
  MoreHorizontal,
  NotebookPen,
  Package,
  Paperclip,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmDialog';
import {
  getClient,
  getClientNotes,
  getAppointments,
  createAppointment,
  createAppointmentNote,
  createNote,
  updateNote,
  deleteNote,
  updateAppointment,
  updateClient,
  getClinicRooms,
  attachNoteFile,
  deleteNoteFile,
  downloadNoteFile,
  apiErrorMessage,
} from '../services/api';
import type { Appointment, AppointmentStatus, Client, ClinicRoom, Note } from '../types';
import {
  APPOINTMENT_STATUSES,
  appointmentPaid,
  appointmentStatus,
  appointmentStatusLabel,
  sessionDuration,
  sessionDurationLabel,
  sessionDurationOptions,
} from '../types';
import { SessionPackages } from '../components/SessionPackages';
import { ClientInventories } from '../components/ClientInventories';
import { istanbulTodayYmd } from '../utils/dates';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogBody, DialogContent, DialogFooter } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Field, FormError, Input, NativeSelect, Switch, Textarea } from '@/components/ui/input';
import { Avatar, EmptyState, LoadingRows, PageContainer } from '@/components/ui/page';
import { cn } from '@/lib/utils';

type Tab = 'appointments' | 'notes' | 'packages' | 'inventories';

type AppointmentDialogState = { mode: 'new' } | { mode: 'edit'; id: number } | null;

const STATUS_BADGE: Record<AppointmentStatus, 'neutral' | 'success' | 'danger' | 'muted'> = {
  scheduled: 'neutral',
  attended: 'success',
  no_show: 'danger',
  cancelled: 'muted',
};

const toDateInputValue = (value: string | null | undefined): string => {
  if (!value) return '';
  return value.includes('T') ? value.split('T')[0] : value.slice(0, 10);
};

const parseYmd = (value: string) => {
  const [year, month, day] = toDateInputValue(value).split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
};

const emptyAppointmentForm = () => ({
  appointmentDate: istanbulTodayYmd(),
  appointmentTime: '09:00',
  title: '',
  isPaid: false,
  status: 'scheduled' as AppointmentStatus,
  roomId: 0,
  durationMinutes: 50,
  sessionFee: '' as number | '',
});

const emptyClientForm = () => ({
  name: '',
  email: '',
  birthDate: '',
  agreedFee: 0,
  phone: '',
  emergencyName: '',
  emergencyPhone: '',
});

const emptyNoteForm = () => ({ title: '', content: '', noteDate: istanbulTodayYmd() });

const InfoItem = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="min-w-0">
    <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
    <dd className="m-0 mt-0.5 truncate text-sm">{children}</dd>
  </div>
);

export const ClientDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const [client, setClient] = useState<Client | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [notesByAppointment, setNotesByAppointment] = useState<Record<number, Note[]>>({});
  const [allNotes, setAllNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('appointments');
  const [expandedAppointments, setExpandedAppointments] = useState<Set<number>>(new Set());
  const [showNoteFormFor, setShowNoteFormFor] = useState<number | null>(null);
  const [appointmentDialog, setAppointmentDialog] = useState<AppointmentDialogState>(null);
  const [appointmentError, setAppointmentError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editingClient, setEditingClient] = useState(false);
  const [clientForm, setClientForm] = useState(emptyClientForm());
  const [savingClient, setSavingClient] = useState(false);
  const [clientFormError, setClientFormError] = useState<string | null>(null);
  const [appointmentForm, setAppointmentForm] = useState(emptyAppointmentForm);
  const [rooms, setRooms] = useState<ClinicRoom[]>([]);
  const [noteForm, setNoteForm] = useState(emptyNoteForm);
  const [looseNote, setLooseNote] = useState(emptyNoteForm);
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [noteSearch, setNoteSearch] = useState('');

  const fillClientForm = (foundClient: Client) => {
    setClientForm({
      name: foundClient.name || '',
      email: foundClient.email || '',
      birthDate: toDateInputValue(foundClient.birthDate),
      agreedFee: foundClient.agreedFee ?? 0,
      phone: foundClient.phone || '',
      emergencyName: foundClient.emergencyName || '',
      emergencyPhone: foundClient.emergencyPhone || '',
    });
  };

  const loadClientData = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const foundClient = await getClient(Number(id));
      setClient(foundClient);
      fillClientForm(foundClient);
      const [appointmentsData, notesData] = await Promise.all([
        getAppointments(foundClient.id),
        getClientNotes(foundClient.id),
      ]);
      setAppointments(appointmentsData);
      setAllNotes(notesData);
      const notesMap: Record<number, Note[]> = {};
      for (const note of notesData) {
        if (note.appointmentId == null) continue;
        notesMap[note.appointmentId] = [...(notesMap[note.appointmentId] || []), note];
      }
      setNotesByAppointment(notesMap);
    } catch (error) {
      console.error('Error loading client data:', error);
      setClient(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) loadClientData();
  }, [id, loadClientData]);

  useEffect(() => {
    getClinicRooms()
      .then(setRooms)
      .catch(() => setRooms([]));
  }, []);

  const openNewAppointment = () => {
    setAppointmentForm(emptyAppointmentForm());
    setAppointmentError(null);
    setAppointmentDialog({ mode: 'new' });
  };

  const startEditAppointment = (apt: Appointment) => {
    setAppointmentForm({
      appointmentDate: toDateInputValue(apt.appointmentDate),
      appointmentTime: apt.appointmentTime || '09:00',
      title: apt.title || '',
      isPaid: appointmentPaid(apt.isPaid),
      status: appointmentStatus(apt.status),
      roomId: apt.roomId || 0,
      durationMinutes: sessionDuration(apt.durationMinutes),
      sessionFee: apt.sessionFee ?? '',
    });
    setAppointmentError(null);
    setAppointmentDialog({ mode: 'edit', id: apt.id });
  };

  const handleSaveAppointment = async (e: FormEvent) => {
    e.preventDefault();
    if (!client || !appointmentDialog) return;
    setAppointmentError(null);
    try {
      setSubmitting(true);
      if (appointmentDialog.mode === 'new') {
        await createAppointment({
          clientId: client.id,
          appointmentDate: appointmentForm.appointmentDate,
          appointmentTime: appointmentForm.appointmentTime,
          title: appointmentForm.title || undefined,
          isPaid: appointmentForm.isPaid,
          roomId: appointmentForm.roomId || undefined,
          durationMinutes: sessionDuration(appointmentForm.durationMinutes),
          sessionFee: appointmentForm.sessionFee === '' ? undefined : Number(appointmentForm.sessionFee),
        });
      } else {
        await updateAppointment(client.id, appointmentDialog.id, {
          appointmentDate: appointmentForm.appointmentDate,
          appointmentTime: appointmentForm.appointmentTime,
          title: appointmentForm.title,
          isPaid: appointmentForm.isPaid,
          status: appointmentForm.status,
          roomId: appointmentForm.roomId,
          durationMinutes: sessionDuration(appointmentForm.durationMinutes),
          sessionFee: appointmentForm.sessionFee === '' ? undefined : Number(appointmentForm.sessionFee),
          clearSessionFee: appointmentForm.sessionFee === '',
        });
      }
      setAppointmentDialog(null);
      setAppointmentForm(emptyAppointmentForm());
      loadClientData();
    } catch (error: unknown) {
      console.error('Error saving appointment:', error);
      setAppointmentError(apiErrorMessage(error, 'Randevu kaydedilirken bir hata oluştu.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelAppointment = async (appointmentId: number) => {
    if (!client) return;
    const ok = await confirm({
      title: 'Randevuyu iptal et',
      message: 'Randevu iptal edilsin mi? Kayıt ve notlar durur, saat boşalır.',
      confirmLabel: 'İptal et',
      danger: true,
    });
    if (!ok) return;
    try {
      await updateAppointment(client.id, appointmentId, { status: 'cancelled' });
      loadClientData();
    } catch (error) {
      console.error('Error cancelling appointment:', error);
      showToast('Randevu iptal edilirken bir hata oluştu.', 'error');
    }
  };

  const handleAddNoteToAppointment = async (appointmentId: number, e: FormEvent) => {
    e.preventDefault();
    if (!client || !noteForm.content.trim()) return;
    try {
      setSubmitting(true);
      await createAppointmentNote(client.id, appointmentId, {
        title: noteForm.title || undefined,
        content: noteForm.content,
        noteDate: noteForm.noteDate,
      });
      resetNoteForm();
      loadClientData();
    } catch (error) {
      console.error('Error adding note:', error);
      showToast(apiErrorMessage(error, 'Not eklenirken bir hata oluştu.'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddStandaloneNote = async (e: FormEvent) => {
    e.preventDefault();
    if (!client || !looseNote.content.trim()) return;
    try {
      setSubmitting(true);
      await createNote({
        clientId: client.id,
        title: looseNote.title || undefined,
        content: looseNote.content.trim(),
        noteDate: looseNote.noteDate,
      });
      setLooseNote(emptyNoteForm());
      showToast('Not kaydedildi.');
      loadClientData();
    } catch (error) {
      showToast(apiErrorMessage(error, 'Not eklenirken bir hata oluştu.'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleNoteFile = async (noteId: number, file: File) => {
    if (!client) return;
    try {
      await attachNoteFile(client.id, noteId, file);
      loadClientData();
    } catch (error) {
      showToast(apiErrorMessage(error, 'Ek yüklenemedi.'), 'error');
    }
  };

  const handleDownloadFile = async (note: Note) => {
    if (!client) return;
    try {
      await downloadNoteFile(client.id, note.id, note.fileName);
    } catch (error) {
      showToast(apiErrorMessage(error, 'Ek indirilemedi.'), 'error');
    }
  };

  const handleDeleteFile = async (note: Note) => {
    if (!client) return;
    const ok = await confirm({
      title: 'Eki sil',
      message: `${note.fileName || 'Ek'} silinsin mi?`,
      confirmLabel: 'Sil',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteNoteFile(client.id, note.id);
      loadClientData();
    } catch (error) {
      showToast(apiErrorMessage(error, 'Ek silinemedi.'), 'error');
    }
  };

  const resetNoteForm = () => {
    setNoteForm(emptyNoteForm());
    setEditingNoteId(null);
    setShowNoteFormFor(null);
  };

  const startEditNote = (note: Note) => {
    setEditingNoteId(note.id);
    setShowNoteFormFor(null);
    setNoteForm({
      title: note.title || '',
      content: note.content,
      noteDate: toDateInputValue(note.noteDate),
    });
  };

  const handleUpdateNote = async (e: FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!client || editingNoteId == null || !noteForm.content.trim()) return;
    try {
      setSubmitting(true);
      await updateNote(client.id, editingNoteId, {
        title: noteForm.title,
        content: noteForm.content.trim(),
        noteDate: noteForm.noteDate,
      });
      resetNoteForm();
      loadClientData();
    } catch (error) {
      console.error('Error updating note:', error);
      showToast(apiErrorMessage(error, 'Not güncellenemedi.'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteNote = async (noteId: number) => {
    if (!client) return;
    const ok = await confirm({
      title: 'Notu sil',
      message: 'Bu not silinsin mi? Bu işlem geri alınamaz.',
      confirmLabel: 'Sil',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteNote(client.id, noteId);
      if (editingNoteId === noteId) {
        resetNoteForm();
      }
      loadClientData();
    } catch (error) {
      console.error('Error deleting note:', error);
      showToast(apiErrorMessage(error, 'Not silinemedi.'), 'error');
    }
  };

  const toggleAppointmentExpand = (aptId: number) => {
    setExpandedAppointments((prev) => {
      const next = new Set(prev);
      if (next.has(aptId)) next.delete(aptId);
      else next.add(aptId);
      return next;
    });
  };

  const handleSaveClient = async (e: FormEvent) => {
    e.preventDefault();
    if (!client) return;
    const name = clientForm.name.trim();
    if (!name) {
      setClientFormError('Ad soyad zorunludur.');
      return;
    }
    try {
      setSavingClient(true);
      setClientFormError(null);
      await updateClient(client.id, {
        name,
        email: clientForm.email.trim(),
        birthDate: clientForm.birthDate,
        agreedFee: clientForm.agreedFee,
        phone: clientForm.phone,
        emergencyName: clientForm.emergencyName,
        emergencyPhone: clientForm.emergencyPhone,
      });
      setEditingClient(false);
      showToast('Danışan bilgileri kaydedildi.');
      loadClientData();
    } catch (error) {
      console.error('Error updating client:', error);
      setClientFormError(apiErrorMessage(error, 'Danışan bilgileri kaydedilemedi.'));
    } finally {
      setSavingClient(false);
    }
  };

  const noteMatchesSearch = (note: Note) => {
    const query = noteSearch.trim().toLocaleLowerCase('tr-TR');
    if (!query) return true;
    const title = (note.title || '').toLocaleLowerCase('tr-TR');
    const content = (note.content || '').toLocaleLowerCase('tr-TR');
    return title.includes(query) || content.includes(query);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '–';
    return new Date(dateString).toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const appointmentLabel = (appointmentId: number | null) => {
    if (appointmentId == null) return null;
    const apt = appointments.find((item) => item.id === appointmentId);
    if (!apt) return null;
    return `${format(parseYmd(apt.appointmentDate), 'd MMM yyyy', { locale: tr })} seansı`;
  };

  const renderNoteEditForm = (onSubmit: (e: FormEvent) => void, submitLabel: string, onCancel: () => void) => (
    <form className="flex flex-col gap-3 rounded-lg border border-solid bg-muted/40 p-4" onSubmit={onSubmit} onClick={(e) => e.stopPropagation()}>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
        <Field label="Başlık" htmlFor="note-title">
          <Input id="note-title" value={noteForm.title} onChange={(e) => setNoteForm({ ...noteForm, title: e.target.value })} placeholder="Opsiyonel" />
        </Field>
        <Field label="Tarih" htmlFor="note-date">
          <Input id="note-date" type="date" value={noteForm.noteDate} onChange={(e) => setNoteForm({ ...noteForm, noteDate: e.target.value })} required />
        </Field>
      </div>
      <Field label="İçerik *" htmlFor="note-content">
        <Textarea
          id="note-content"
          value={noteForm.content}
          onChange={(e) => setNoteForm({ ...noteForm, content: e.target.value })}
          rows={5}
          required
          autoFocus
        />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={submitting}>
          {submitting ? <Loader2 className="animate-spin" /> : <Check />}
          {submitLabel}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Vazgeç
        </Button>
      </div>
    </form>
  );

  const renderNoteCard = (note: Note, showAppointment = false) => {
    if (editingNoteId === note.id) {
      return <div key={note.id}>{renderNoteEditForm(handleUpdateNote, 'Kaydet', resetNoteForm)}</div>;
    }
    const linked = showAppointment ? appointmentLabel(note.appointmentId) : null;
    return (
      <article key={note.id} className="rounded-lg border border-solid bg-card p-4">
        <header className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="m-0 text-sm font-semibold">{note.title || 'Başlıksız not'}</h3>
            <p className="m-0 mt-0.5 text-xs text-muted-foreground">
              {formatDate(note.noteDate)}
              {linked ? ` · ${linked}` : ''}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Not işlemleri">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => startEditNote(note)}>
                <Pencil />
                Düzenle
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onSelect={() => void handleDeleteNote(note.id)}>
                <Trash2 />
                Sil
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <p className="m-0 mt-3 whitespace-pre-wrap text-sm leading-relaxed">{note.content}</p>
        <footer className="mt-3 flex flex-wrap items-center gap-2">
          {note.fileName ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-solid bg-muted/50 py-0.5 pl-2 pr-0.5 text-xs">
              <Paperclip className="size-3 text-muted-foreground" />
              <button
                type="button"
                onClick={() => void handleDownloadFile(note)}
                className="max-w-48 cursor-pointer truncate border-0 bg-transparent p-0 text-xs font-medium text-foreground [font-family:inherit] hover:underline"
              >
                {note.fileName}
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteFile(note)}
                aria-label="Eki sil"
                className="flex size-5 cursor-pointer items-center justify-center rounded border-0 bg-transparent text-muted-foreground hover:bg-accent hover:text-destructive"
              >
                <X className="size-3" />
              </button>
            </span>
          ) : (
            <label className="inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground">
              <Paperclip className="size-3" />
              Ek yükle
              <input
                type="file"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleNoteFile(note.id, file);
                  e.target.value = '';
                }}
              />
            </label>
          )}
        </footer>
      </article>
    );
  };

  if (loading) {
    return (
      <PageContainer>
        <Card>
          <LoadingRows rows={4} />
        </Card>
      </PageContainer>
    );
  }

  if (!client) {
    return (
      <PageContainer>
        <Card>
          <EmptyState
            icon={X}
            title="Danışan bulunamadı"
            action={
              <Button variant="outline" onClick={() => navigate('/danisanlar')}>
                <ArrowLeft />
                Danışanlara dön
              </Button>
            }
          />
        </Card>
      </PageContainer>
    );
  }

  const filteredNotes = allNotes.filter(noteMatchesSearch);
  const upcomingCount = appointments.filter(
    (apt) => appointmentStatus(apt.status) === 'scheduled' && toDateInputValue(apt.appointmentDate) >= istanbulTodayYmd()
  ).length;

  const tabs: { value: Tab; label: string; icon: typeof FileText; count?: number }[] = [
    { value: 'appointments', label: 'Randevular', icon: CalendarPlus, count: appointments.length },
    { value: 'notes', label: 'Notlar', icon: NotebookPen, count: allNotes.length },
    { value: 'packages', label: 'Paketler', icon: Package },
    { value: 'inventories', label: 'Ölçekler', icon: ClipboardList },
  ];

  return (
    <PageContainer>
      <Button variant="ghost" size="sm" className="-ml-2 mb-4 text-muted-foreground" onClick={() => navigate('/danisanlar')}>
        <ArrowLeft />
        Danışanlar
      </Button>

      <Card className="mb-6 p-5 md:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <Avatar name={client.name} className="size-14 text-lg" />
          <div className="min-w-0 flex-1">
            <h1 className="m-0 text-2xl font-semibold tracking-tight">{client.name || 'İsimsiz danışan'}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
              {client.phone ? (
                <a href={`tel:${client.phone}`} className="inline-flex items-center gap-1.5 text-foreground no-underline hover:underline">
                  <Phone className="size-3.5 text-muted-foreground" />
                  {client.phone}
                </a>
              ) : null}
              {client.email ? (
                <a href={`mailto:${client.email}`} className="inline-flex items-center gap-1.5 text-foreground no-underline hover:underline">
                  <Mail className="size-3.5 text-muted-foreground" />
                  {client.email}
                </a>
              ) : null}
              {!client.phone && !client.email ? <span>İletişim bilgisi eklenmemiş</span> : null}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                fillClientForm(client);
                setClientFormError(null);
                setEditingClient(true);
              }}
            >
              <Pencil />
              Düzenle
            </Button>
            <Button onClick={openNewAppointment}>
              <CalendarPlus />
              Randevu
            </Button>
          </div>
        </div>
        <dl className="m-0 mt-6 grid grid-cols-2 gap-4 border-0 border-t border-solid pt-5 sm:grid-cols-3 lg:grid-cols-5">
          <InfoItem label="Anlaşılan ücret">
            {client.agreedFee != null ? `${client.agreedFee.toLocaleString('tr-TR')} ₺` : '–'}
          </InfoItem>
          <InfoItem label="Doğum tarihi">{formatDate(client.birthDate)}</InfoItem>
          <InfoItem label="Acil durum kişisi">{client.emergencyName || '–'}</InfoItem>
          <InfoItem label="Acil durum telefonu">
            {client.emergencyPhone ? (
              <a href={`tel:${client.emergencyPhone}`} className="text-foreground no-underline hover:underline">
                {client.emergencyPhone}
              </a>
            ) : (
              '–'
            )}
          </InfoItem>
          <InfoItem label="Kayıt tarihi">{formatDate(client.createdAt)}</InfoItem>
          <InfoItem label="Kaydı oluşturan">{client.createdByName || '–'}</InfoItem>
          <InfoItem label="Son güncelleyen">{client.updatedByName || '–'}</InfoItem>
        </dl>
      </Card>

      <div
        className="mb-5 flex gap-1 overflow-x-auto border-0 border-b border-solid [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
      >
        {tabs.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={tab === item.value}
            onClick={() => setTab(item.value)}
            className={cn(
              '-mb-px flex shrink-0 cursor-pointer items-center gap-2 border-0 border-b-2 border-solid bg-transparent px-2.5 py-2.5 text-sm font-medium [font-family:inherit] transition-colors sm:px-3',
              tab === item.value
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <item.icon className="hidden size-4 sm:block" />
            {item.label}
            {item.count != null ? (
              <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">{item.count}</span>
            ) : null}
          </button>
        ))}
      </div>

      {tab === 'appointments' ? (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-5 py-4">
            <p className="m-0 text-sm text-muted-foreground">
              {appointments.length} randevu{upcomingCount > 0 ? ` · ${upcomingCount} yaklaşan` : ''}
            </p>
            <Button size="sm" variant="outline" onClick={openNewAppointment}>
              <Plus />
              Randevu ekle
            </Button>
          </div>
          {appointments.length === 0 ? (
            <EmptyState
              icon={CalendarPlus}
              title="Henüz randevu yok"
              hint="Randevu ekledikten sonra her seansa not ekleyebilirsiniz."
              className="border-0 border-t border-solid"
            />
          ) : (
            <ul className="m-0 list-none divide-y divide-border border-0 border-t border-solid p-0">
              {appointments.map((apt) => {
                const status = appointmentStatus(apt.status);
                const paid = appointmentPaid(apt.isPaid);
                const expanded = expandedAppointments.has(apt.id);
                const aptNotes = notesByAppointment[apt.id] || [];
                const date = parseYmd(apt.appointmentDate);
                return (
                  <li key={apt.id} className={cn(status === 'cancelled' && 'bg-muted/30')}>
                    <div className="flex items-center gap-4 px-5 py-3.5">
                      <button
                        type="button"
                        onClick={() => toggleAppointmentExpand(apt.id)}
                        aria-expanded={expanded}
                        className="flex min-w-0 flex-1 cursor-pointer items-center gap-4 border-0 bg-transparent p-0 text-left text-foreground [font-family:inherit]"
                      >
                        <span className={cn('flex w-12 shrink-0 flex-col items-center rounded-lg border border-solid py-1', status === 'cancelled' && 'opacity-60')}>
                          <span className="text-[11px] font-medium uppercase text-muted-foreground">{format(date, 'MMM', { locale: tr })}</span>
                          <span className="text-lg font-semibold leading-none">{format(date, 'd')}</span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={cn('block truncate text-sm font-medium', status === 'cancelled' && 'text-muted-foreground line-through')}>
                            {format(date, 'EEEE', { locale: tr })} · {apt.appointmentTime || '--:--'}
                          </span>
                          <span className="block truncate text-[13px] text-muted-foreground">
                            {sessionDurationLabel(apt.durationMinutes)}
                            {apt.title ? ` · ${apt.title}` : ''}
                            {apt.roomName ? ` · ${apt.roomName}` : ''}
                            {aptNotes.length > 0 ? ` · ${aptNotes.length} not` : ''}
                          </span>
                        </span>
                        <span className="hidden items-center gap-1.5 sm:flex">
                          <Badge variant={STATUS_BADGE[status]}>{appointmentStatusLabel(status)}</Badge>
                          {status !== 'cancelled' ? (
                            <Badge variant={paid ? 'success' : 'warning'}>{paid ? 'Ödendi' : 'Ödeme bekliyor'}</Badge>
                          ) : null}
                        </span>
                        <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label="Randevu işlemleri">
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => startEditAppointment(apt)}>
                            <Pencil />
                            Düzenle
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => {
                              setExpandedAppointments((prev) => new Set(prev).add(apt.id));
                              setEditingNoteId(null);
                              setNoteForm(emptyNoteForm());
                              setShowNoteFormFor(apt.id);
                            }}
                          >
                            <NotebookPen />
                            Not ekle
                          </DropdownMenuItem>
                          {status !== 'cancelled' ? (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem destructive onSelect={() => void handleCancelAppointment(apt.id)}>
                                <X />
                                İptal et
                              </DropdownMenuItem>
                            </>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    {expanded ? (
                      <div className="flex flex-col gap-3 bg-muted/30 px-5 pb-5 pt-1 sm:pl-[5.25rem]">
                        <div className="flex items-center gap-1.5 sm:hidden">
                          <Badge variant={STATUS_BADGE[status]}>{appointmentStatusLabel(status)}</Badge>
                          {status !== 'cancelled' ? (
                            <Badge variant={paid ? 'success' : 'warning'}>{paid ? 'Ödendi' : 'Ödeme bekliyor'}</Badge>
                          ) : null}
                        </div>
                        {aptNotes.length === 0 && showNoteFormFor !== apt.id ? (
                          <p className="m-0 text-[13px] text-muted-foreground">Bu seansa henüz not eklenmemiş.</p>
                        ) : null}
                        {aptNotes.map((note) => renderNoteCard(note))}
                        {showNoteFormFor === apt.id ? (
                          renderNoteEditForm((e) => void handleAddNoteToAppointment(apt.id, e), 'Notu ekle', resetNoteForm)
                        ) : (
                          <div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingNoteId(null);
                                setNoteForm(emptyNoteForm());
                                setShowNoteFormFor(apt.id);
                              }}
                            >
                              <Plus />
                              Seans notu ekle
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      ) : null}

      {tab === 'notes' ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex min-w-0 flex-col gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                className="pl-9"
                placeholder="Başlık veya içerikte ara"
                value={noteSearch}
                onChange={(e) => setNoteSearch(e.target.value)}
                aria-label="Notlarda ara"
              />
            </div>
            {allNotes.length === 0 ? (
              <Card>
                <EmptyState icon={NotebookPen} title="Henüz not yok" hint="Sağdaki formdan veya bir seansın altından not ekleyebilirsiniz." />
              </Card>
            ) : filteredNotes.length === 0 ? (
              <Card>
                <EmptyState icon={Search} title="Aramanızla eşleşen not yok" />
              </Card>
            ) : (
              filteredNotes.map((note) => renderNoteCard(note, true))
            )}
          </div>
          <Card className="h-fit p-5 lg:sticky lg:top-6">
            <h2 className="m-0 text-[15px] font-semibold">Yeni not</h2>
            <p className="m-0 mt-1 text-[13px] text-muted-foreground">Bir seansa bağlı olmayan notlar için.</p>
            <form className="mt-4 flex flex-col gap-3" onSubmit={handleAddStandaloneNote}>
              <Field label="Başlık" htmlFor="loose-title">
                <Input
                  id="loose-title"
                  value={looseNote.title}
                  onChange={(e) => setLooseNote({ ...looseNote, title: e.target.value })}
                  placeholder="Opsiyonel"
                />
              </Field>
              <Field label="İçerik *" htmlFor="loose-content">
                <Textarea
                  id="loose-content"
                  value={looseNote.content}
                  onChange={(e) => setLooseNote({ ...looseNote, content: e.target.value })}
                  rows={5}
                  required
                />
              </Field>
              <Button type="submit" disabled={submitting} className="self-start">
                {submitting ? <Loader2 className="animate-spin" /> : <Check />}
                Notu kaydet
              </Button>
            </form>
          </Card>
        </div>
      ) : null}

      {tab === 'packages' ? <SessionPackages clientId={client.id} /> : null}
      {tab === 'inventories' ? <ClientInventories clientId={client.id} /> : null}

      <Dialog open={editingClient} onOpenChange={(open) => (open ? null : setEditingClient(false))}>
        <DialogContent title="Danışan bilgileri">
          <form onSubmit={handleSaveClient}>
            <DialogBody>
              <Field label="Ad soyad *" htmlFor="client-name">
                <Input id="client-name" required value={clientForm.name} onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="E-posta" htmlFor="client-email">
                  <Input id="client-email" type="email" value={clientForm.email} onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })} />
                </Field>
                <Field label="Telefon" htmlFor="client-phone">
                  <Input id="client-phone" type="tel" value={clientForm.phone} onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })} />
                </Field>
                <Field label="Doğum tarihi" htmlFor="client-birthDate">
                  <Input
                    id="client-birthDate"
                    type="date"
                    value={clientForm.birthDate}
                    onChange={(e) => setClientForm({ ...clientForm, birthDate: e.target.value })}
                  />
                </Field>
                <Field label="Anlaşılan ücret (₺)" htmlFor="client-agreedFee">
                  <Input
                    id="client-agreedFee"
                    type="number"
                    min={0}
                    step={100}
                    value={clientForm.agreedFee}
                    onChange={(e) => setClientForm({ ...clientForm, agreedFee: Number(e.target.value) || 0 })}
                  />
                </Field>
                <Field label="Acil durum kişisi" htmlFor="client-emergencyName">
                  <Input
                    id="client-emergencyName"
                    value={clientForm.emergencyName}
                    onChange={(e) => setClientForm({ ...clientForm, emergencyName: e.target.value })}
                  />
                </Field>
                <Field label="Acil durum telefonu" htmlFor="client-emergencyPhone">
                  <Input
                    id="client-emergencyPhone"
                    type="tel"
                    value={clientForm.emergencyPhone}
                    onChange={(e) => setClientForm({ ...clientForm, emergencyPhone: e.target.value })}
                  />
                </Field>
              </div>
              <FormError>{clientFormError}</FormError>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingClient(false)}>
                Vazgeç
              </Button>
              <Button type="submit" disabled={savingClient}>
                {savingClient ? <Loader2 className="animate-spin" /> : null}
                {savingClient ? 'Kaydediliyor...' : 'Kaydet'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={appointmentDialog !== null} onOpenChange={(open) => (open ? null : setAppointmentDialog(null))}>
        <DialogContent
          title={appointmentDialog?.mode === 'edit' ? 'Randevuyu düzenle' : 'Yeni randevu'}
          description={client.name || undefined}
        >
          <form onSubmit={handleSaveAppointment}>
            <DialogBody>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Field label="Tarih *" htmlFor="apt-date" className="col-span-2 sm:col-span-1">
                  <Input
                    id="apt-date"
                    type="date"
                    value={appointmentForm.appointmentDate}
                    onChange={(e) => setAppointmentForm({ ...appointmentForm, appointmentDate: e.target.value })}
                    required
                  />
                </Field>
                <Field label="Saat *" htmlFor="apt-time">
                  <Input
                    id="apt-time"
                    type="time"
                    value={appointmentForm.appointmentTime}
                    onChange={(e) => setAppointmentForm({ ...appointmentForm, appointmentTime: e.target.value })}
                    required
                  />
                </Field>
                <Field label="Süre *" htmlFor="apt-duration">
                  <NativeSelect
                    id="apt-duration"
                    value={appointmentForm.durationMinutes}
                    onChange={(e) => setAppointmentForm({ ...appointmentForm, durationMinutes: sessionDuration(Number(e.target.value)) })}
                  >
                    {sessionDurationOptions(appointmentForm.durationMinutes).map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {appointmentDialog?.mode === 'edit' ? (
                  <Field label="Durum" htmlFor="apt-status">
                    <NativeSelect
                      id="apt-status"
                      value={appointmentForm.status}
                      onChange={(e) => setAppointmentForm({ ...appointmentForm, status: appointmentStatus(e.target.value) })}
                    >
                      {APPOINTMENT_STATUSES.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                ) : null}
                {rooms.length > 0 ? (
                  <Field label="Oda" htmlFor="apt-room">
                    <NativeSelect
                      id="apt-room"
                      value={appointmentForm.roomId}
                      onChange={(e) => setAppointmentForm({ ...appointmentForm, roomId: Number(e.target.value) })}
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
                <Field label="Başlık" htmlFor="apt-title">
                  <Input
                    id="apt-title"
                    value={appointmentForm.title}
                    onChange={(e) => setAppointmentForm({ ...appointmentForm, title: e.target.value })}
                    placeholder="Örn. İlk görüşme"
                  />
                </Field>
                <Field label="Bu seansın ücreti (₺)" htmlFor="apt-fee" hint="Boş bırakırsanız anlaşılan ücret kullanılır.">
                  <Input
                    id="apt-fee"
                    type="number"
                    min={0}
                    placeholder={client.agreedFee != null ? String(client.agreedFee) : 'Anlaşılan ücret'}
                    value={appointmentForm.sessionFee}
                    onChange={(e) =>
                      setAppointmentForm({ ...appointmentForm, sessionFee: e.target.value === '' ? '' : Number(e.target.value) })
                    }
                  />
                </Field>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-solid px-4 py-3">
                <div>
                  <p className="m-0 text-sm font-medium">Ödeme alındı</p>
                  <p className="m-0 text-xs text-muted-foreground">Ödemeler ve raporlar bu işarete göre hesaplanır.</p>
                </div>
                <Switch
                  checked={appointmentForm.isPaid}
                  onCheckedChange={(checked) => setAppointmentForm({ ...appointmentForm, isPaid: checked })}
                  aria-label="Ödeme alındı"
                />
              </div>
              <FormError>{appointmentError}</FormError>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAppointmentDialog(null)}>
                Vazgeç
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="animate-spin" /> : null}
                {appointmentDialog?.mode === 'edit' ? 'Kaydet' : 'Randevuyu ekle'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
};
