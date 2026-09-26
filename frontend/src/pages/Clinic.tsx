import { useState, useEffect, useCallback, type FormEvent } from 'react';
import {
  Building2,
  Check,
  Copy,
  Crown,
  DoorOpen,
  KeyRound,
  LogOut,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  UserMinus,
  UsersRound,
} from 'lucide-react';
import {
  createClinic,
  createClinicRoom,
  deleteClinic,
  deleteClinicRoom,
  getMyClinic,
  joinClinic,
  kickClinicMember,
  leaveClinic,
  renameClinic,
  rotateClinicInvite,
  transferClinicOwnership,
  updateClinicRoom,
  apiErrorMessage,
} from '../services/api';
import { clinicCan } from '../types';
import type { Clinic } from '../types';
import { ClinicCommissions } from '../components/ClinicCommissions';
import { ClinicInvitations } from '../components/ClinicInvitations';
import { useConfirm } from '../contexts/ConfirmDialog';
import { useToast } from '../contexts/ToastContext';
import { useClinics } from '../contexts/ClinicContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FormError, Input } from '@/components/ui/input';
import { Avatar, LoadingRows, PageContainer, PageHeader } from '@/components/ui/page';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const ColorInput = ({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) => (
  <label className="relative flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md border border-solid border-input bg-card">
    <span className="size-5 rounded" style={{ background: value }} />
    <input type="color" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className="absolute inset-0 cursor-pointer opacity-0" />
  </label>
);

export const ClinicPage = () => {
  const { confirm } = useConfirm();
  const { showToast } = useToast();
  const { reload: reloadClinics } = useClinics();
  const [showAdd, setShowAdd] = useState(false);
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clinicName, setClinicName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [roomName, setRoomName] = useState('');
  const [roomColor, setRoomColor] = useState('#7a4a2b');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [editingRoomId, setEditingRoomId] = useState<number | null>(null);
  const [editingRoomName, setEditingRoomName] = useState('');
  const [editingRoomColor, setEditingRoomColor] = useState('#7a4a2b');
  const isOwner = clinic?.role === 'owner';
  const canManageClinic = clinicCan(clinic, 'MANAGE_CLINIC');
  const canManageRooms = clinicCan(clinic, 'MANAGE_ROOMS');
  const canInvite = clinicCan(clinic, 'INVITE_MEMBERS');
  const canManageMembers = clinicCan(clinic, 'MANAGE_MEMBERS');
  const canSetCommission = clinicCan(clinic, 'SET_COMMISSION');

  const loadClinic = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getMyClinic();
      setClinic(data);
      if (data) {
        setRenameValue(data.name);
      }
    } catch (err) {
      setError(apiErrorMessage(err, 'Klinik bilgisi alınamadı.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClinic();
  }, [loadClinic]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const created = await createClinic(clinicName);
      setClinic(created);
      await reloadClinics(created.id);
      setClinicName('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Klinik oluşturulamadı.'));
    } finally {
      setSaving(false);
    }
  };

  const handleJoin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const joined = await joinClinic(inviteCode);
      setClinic(joined);
      await reloadClinics(joined.id);
      setInviteCode('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Kliniğe katılınamadı.'));
    } finally {
      setSaving(false);
    }
  };

  const handleAddRoom = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await createClinicRoom(roomName, roomColor);
      setRoomName('');
      await loadClinic();
    } catch (err) {
      setError(apiErrorMessage(err, 'Oda eklenemedi.'));
    } finally {
      setSaving(false);
    }
  };

  const handleCopyCode = async () => {
    if (!clinic) return;
    try {
      await navigator.clipboard.writeText(clinic.inviteCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Kod kopyalanamadı.');
    }
  };

  const handleLeave = async () => {
    const ok = await confirm({
      title: 'Klinikten ayrıl',
      message: 'Klinikten ayrılmak istiyor musunuz? Bu klinikteki danışanlarınız sizde kalır ve kişisel olur; gelecek randevularınızdaki klinik ve oda bilgisi kaldırılır.',
      confirmLabel: 'Ayrıl',
      danger: true,
    });
    if (!ok) return;
    setError(null);
    try {
      await leaveClinic();
      await reloadClinics();
      setClinic(null);
    } catch (err) {
      setError(apiErrorMessage(err, 'Ayrılamadınız.'));
    }
  };

  const handleDeleteClinic = async () => {
    const ok = await confirm({
      title: 'Kliniği sil',
      message: 'Klinik ve odalar silinsin mi? Randevular kalır, oda bilgisi gider.',
      confirmLabel: 'Kliniği sil',
      danger: true,
    });
    if (!ok) return;
    setError(null);
    try {
      await deleteClinic();
      await reloadClinics();
      setClinic(null);
    } catch (err) {
      setError(apiErrorMessage(err, 'Klinik silinemedi.'));
    }
  };

  const handleDeleteRoom = async (roomId: number, name: string) => {
    const ok = await confirm({
      title: 'Odayı sil',
      message: `${name} silinsin mi? Bu odadaki randevuların oda bilgisi kaldırılır.`,
      confirmLabel: 'Sil',
      danger: true,
    });
    if (!ok) return;
    setError(null);
    try {
      await deleteClinicRoom(roomId);
      await loadClinic();
    } catch (err) {
      setError(apiErrorMessage(err, 'Oda silinemedi.'));
    }
  };

  const handleRename = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      setClinic(await renameClinic(renameValue));
      showToast('Klinik adı güncellendi.');
    } catch (err) {
      setError(apiErrorMessage(err, 'Klinik adı güncellenemedi.'));
    }
  };

  const handleRotate = async () => {
    const ok = await confirm({
      title: 'Davet kodunu yenile',
      message: 'Davet kodu yenilensin mi? Eski kod artık çalışmaz.',
      confirmLabel: 'Yenile',
      danger: true,
    });
    if (!ok) return;
    setError(null);
    try {
      setClinic(await rotateClinicInvite());
    } catch (err) {
      setError(apiErrorMessage(err, 'Kod yenilenemedi.'));
    }
  };

  const handleKick = async (userId: number, name: string) => {
    const ok = await confirm({
      title: 'Üyeyi çıkar',
      message: `${name} klinikten çıkarılsın mı?`,
      confirmLabel: 'Çıkar',
      danger: true,
    });
    if (!ok) return;
    setError(null);
    try {
      setClinic(await kickClinicMember(userId));
    } catch (err) {
      setError(apiErrorMessage(err, 'Üye çıkarılamadı.'));
    }
  };

  const handleTransfer = async (userId: number, name: string) => {
    const ok = await confirm({
      title: 'Kurucuyu değiştir',
      message: `Kurucu yetkisi ${name} kişisine geçsin mi? Siz üye olursunuz.`,
      confirmLabel: 'Devret',
      danger: true,
    });
    if (!ok) return;
    setError(null);
    try {
      setClinic(await transferClinicOwnership(userId));
    } catch (err) {
      setError(apiErrorMessage(err, 'Sahiplik devredilemedi.'));
    }
  };

  const handleSaveRoom = async (e: FormEvent) => {
    e.preventDefault();
    if (editingRoomId == null) return;
    setError(null);
    try {
      await updateClinicRoom(editingRoomId, { name: editingRoomName, color: editingRoomColor });
      setEditingRoomId(null);
      await loadClinic();
    } catch (err) {
      setError(apiErrorMessage(err, 'Oda güncellenemedi.'));
    }
  };

  const setupForms = (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <form onSubmit={handleCreate} className="flex h-full flex-col gap-4 p-5">
          <span className="flex size-10 items-center justify-center rounded-lg bg-accent text-primary">
            <Building2 className="size-5" />
          </span>
          <div>
            <h2 className="m-0 text-base font-semibold">Klinik oluşturun</h2>
            <p className="m-0 mt-1 text-sm text-muted-foreground">Kurucu siz olursunuz; iki oda hazır gelir.</p>
          </div>
          <Field label="Klinik adı" htmlFor="clinic-name">
            <Input
              id="clinic-name"
              value={clinicName}
              onChange={(e) => setClinicName(e.target.value)}
              placeholder="Örn. Kadıköy Muayenehane"
              required
            />
          </Field>
          <Button type="submit" disabled={saving} className="mt-auto self-start">
            <Plus />
            Oluştur
          </Button>
        </form>
      </Card>
      <Card>
        <form onSubmit={handleJoin} className="flex h-full flex-col gap-4 p-5">
          <span className="flex size-10 items-center justify-center rounded-lg bg-accent text-primary">
            <KeyRound className="size-5" />
          </span>
          <div>
            <h2 className="m-0 text-base font-semibold">Davet koduyla katılın</h2>
            <p className="m-0 mt-1 text-sm text-muted-foreground">Kodu kliniğin kurucusundan alabilirsiniz.</p>
          </div>
          <Field label="Davet kodu" htmlFor="invite-code">
            <Input
              id="invite-code"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              className="font-mono tracking-widest uppercase"
              required
            />
          </Field>
          <Button type="submit" variant="outline" disabled={saving} className="mt-auto self-start">
            Katıl
          </Button>
        </form>
      </Card>
    </div>
  );

  if (loading) {
    return (
      <PageContainer>
        <PageHeader title="Klinik" />
        <Card>
          <LoadingRows />
        </Card>
      </PageContainer>
    );
  }

  if (!clinic) {
    return (
      <PageContainer>
        <PageHeader
          title="Klinik"
          description="Ortak ofiste odaları ve meslektaş takvimini görmek için bir klinik oluşturun veya davet koduyla katılın. Notlarınız size özel kalır."
        />
        {error ? <div className="mb-4"><FormError>{error}</FormError></div> : null}
        {setupForms}
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {clinic.name}
            <Badge variant={isOwner ? 'warning' : 'neutral'}>{isOwner ? 'Kurucu' : 'Üye'}</Badge>
          </span>
        }
        description="Meslektaşlarınız takvimde saat ve oda görür; danışan adı, not ve ücret gizlenir."
      />
      {error ? <div className="mb-4"><FormError>{error}</FormError></div> : null}

      <Card className="mb-6 flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
          <KeyRound className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="m-0 text-sm font-medium">Davet kodu</p>
          <p className="m-0 text-[13px] text-muted-foreground">Bu kodu meslektaşınıza gönderin; Klinik sayfasından katılabilir.</p>
        </div>
        <div className="flex items-center gap-2">
          <code className="rounded-md border border-dashed border-input bg-muted/60 px-3 py-1.5 font-mono text-base font-semibold tracking-[0.2em]">
            {clinic.inviteCode}
          </code>
          <Button variant="outline" size="sm" onClick={handleCopyCode}>
            {copied ? <Check /> : <Copy />}
            {copied ? 'Kopyalandı' : 'Kopyala'}
          </Button>
          {canInvite ? (
            <Button variant="ghost" size="icon-sm" onClick={() => void handleRotate()} aria-label="Kodu yenile" title="Kodu yenile">
              <RefreshCw />
            </Button>
          ) : null}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Terapistler</CardTitle>
              <CardDescription className="mt-1">{clinic.members.length} kişi</CardDescription>
            </div>
            <UsersRound className="size-4 text-muted-foreground" />
          </CardHeader>
          <ul className="m-0 mt-3 list-none divide-y divide-border p-0">
            {clinic.members.map((member) => (
              <li key={member.userId} className="flex items-center gap-3 px-5 py-3">
                <Avatar name={member.name} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{member.name}</span>
                {member.role === 'owner' ? (
                  <Badge variant="warning">
                    <Crown className="size-3" />
                    Kurucu
                  </Badge>
                ) : (
                  <Badge>Üye</Badge>
                )}
                {canManageMembers && member.role !== 'owner' ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={`${member.name} işlemleri`}>
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {canManageClinic ? (
                        <>
                          <DropdownMenuItem onSelect={() => void handleTransfer(member.userId, member.name)}>
                            <Crown />
                            Kurucu yap
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                        </>
                      ) : null}
                      <DropdownMenuItem destructive onSelect={() => void handleKick(member.userId, member.name)}>
                        <UserMinus />
                        Klinikten çıkar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Odalar</CardTitle>
              <CardDescription className="mt-1">Renkler takvimde randevu kartlarına uygulanır.</CardDescription>
            </div>
            <DoorOpen className="size-4 text-muted-foreground" />
          </CardHeader>
          <ul className="m-0 mt-3 list-none divide-y divide-border p-0">
            {clinic.rooms.map((room) => (
              <li key={room.id} className="px-5 py-3">
                {editingRoomId === room.id ? (
                  <form className="flex items-center gap-2" onSubmit={handleSaveRoom}>
                    <ColorInput value={editingRoomColor} onChange={setEditingRoomColor} label="Oda rengi" />
                    <Input value={editingRoomName} onChange={(e) => setEditingRoomName(e.target.value)} aria-label="Oda adı" required autoFocus />
                    <Button type="submit" size="sm">
                      Kaydet
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setEditingRoomId(null)}>
                      Vazgeç
                    </Button>
                  </form>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="size-4 shrink-0 rounded" style={{ background: room.color || 'var(--muted-foreground)' }} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{room.name}</span>
                    {canManageRooms ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label={`${room.name} işlemleri`}>
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onSelect={() => {
                              setEditingRoomId(room.id);
                              setEditingRoomName(room.name);
                              setEditingRoomColor(room.color || '#7a4a2b');
                            }}
                          >
                            <Pencil />
                            Düzenle
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem destructive onSelect={() => void handleDeleteRoom(room.id, room.name)}>
                            <Trash2 />
                            Sil
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </div>
                )}
              </li>
            ))}
          </ul>
          {canManageRooms ? (
            <form className="flex items-center gap-2 border-0 border-t border-solid px-5 py-4" onSubmit={handleAddRoom}>
              <ColorInput value={roomColor} onChange={setRoomColor} label="Yeni oda rengi" />
              <Input
                id="new-room"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="Yeni oda adı"
                aria-label="Yeni oda adı"
                required
              />
              <Button type="submit" variant="outline" disabled={saving}>
                <Plus />
                Ekle
              </Button>
            </form>
          ) : null}
        </Card>
      </div>

      {canInvite || canSetCommission ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {canInvite ? <ClinicInvitations /> : null}
          {canSetCommission ? <ClinicCommissions /> : null}
        </div>
      ) : null}

      <div className="mt-6">
        {showAdd ? (
          <>
            <p className="mb-3 text-sm text-muted-foreground">
              Başka bir klinik ekleyince üstte klinik seçici çıkar. Klinikler birbirinin verisini görmez; takviminiz ortak kalır.
            </p>
            {setupForms}
          </>
        ) : (
          <Button variant="outline" onClick={() => setShowAdd(true)}>
            <Plus />
            Başka bir klinik ekle
          </Button>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {canManageClinic ? (
          <Card>
            <form onSubmit={handleRename} className="flex flex-col gap-4 p-5">
              <div>
                <h2 className="m-0 text-[15px] font-semibold">Klinik adı</h2>
                <p className="m-0 mt-1 text-sm text-muted-foreground">Üyelerin ekranında bu ad görünür.</p>
              </div>
              <div className="flex gap-2">
                <Input id="rename-clinic" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} aria-label="Klinik adı" required />
                <Button type="submit" variant="outline" disabled={saving}>
                  Kaydet
                </Button>
              </div>
            </form>
          </Card>
        ) : null}
        <Card className="border-destructive/30">
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <h2 className="m-0 text-[15px] font-semibold">{isOwner ? 'Kliniği sil' : 'Klinikten ayrıl'}</h2>
              {/* Kurucu ayrılamaz, yalnızca siler; bu yüzden rol (yetki değil) kullanılır. */}
              <p className="m-0 mt-1 text-sm text-muted-foreground">
                {isOwner
                  ? 'Klinik, odalar ve üyelikler silinir. Randevular kalır.'
                  : 'Klinik takvimini ve odaları artık göremezsiniz. Danışanlarınız sizde kalır.'}
              </p>
            </div>
            <Button variant="destructive" onClick={isOwner ? handleDeleteClinic : handleLeave}>
              {isOwner ? <Trash2 /> : <LogOut />}
              {isOwner ? 'Kliniği sil' : 'Ayrıl'}
            </Button>
          </div>
        </Card>
      </div>
    </PageContainer>
  );
};
