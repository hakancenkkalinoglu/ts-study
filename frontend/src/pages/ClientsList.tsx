import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, MoreHorizontal, Phone, Plus, Search, Trash2, UserRound, Users } from 'lucide-react';
import { getClients, deleteClient, apiErrorMessage } from '../services/api';
import type { Client } from '../types';
import { AddClientModal } from '../components/AddClientModal';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, EmptyState, LoadingRows, PageContainer, PageHeader } from '@/components/ui/page';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export const ClientsList = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { confirm } = useConfirm();

  useEffect(() => {
    const timer = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const loadClients = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getClients(searchDebounced || undefined);
      setClients(data);
      setLoadError(null);
    } catch (error) {
      console.error('Error loading clients:', error);
      setLoadError(apiErrorMessage(error, 'Danışan listesi yüklenemedi.'));
    } finally {
      setLoading(false);
    }
  }, [searchDebounced]);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  const handleDelete = async (client: Client) => {
    const ok = await confirm({
      title: 'Danışanı sil',
      message: `${client.name || 'Bu danışan'} silinsin mi? Randevuları, seans notları ve ekleri de kalıcı olarak silinir.`,
      confirmLabel: 'Kalıcı sil',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteClient(client.id);
      showToast('Danışan silindi.');
      loadClients();
    } catch (error) {
      console.error('Error deleting client:', error);
      showToast('Danışan silinirken bir hata oluştu.', 'error');
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '–';
    return new Date(dateString).toLocaleDateString('tr-TR');
  };

  const rowMenu = (client: Client) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`${client.name || 'Danışan'} işlemleri`} onClick={(e) => e.stopPropagation()}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onSelect={() => navigate(`/client/${client.id}`)}>
          <UserRound />
          Danışan sayfası
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onSelect={() => void handleDelete(client)}>
          <Trash2 />
          Sil
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <PageContainer>
      <PageHeader
        title="Danışanlar"
        description={loading ? 'Yükleniyor...' : `${clients.length} danışan`}
        actions={
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus />
            Yeni danışan
          </Button>
        }
      />

      <div className="relative mb-4 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Ad, e-posta veya telefon ile ara"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Danışan ara"
          className="pl-9"
        />
      </div>

      {loadError ? <p className="mb-4 text-sm text-destructive">{loadError}</p> : null}

      <Card className="overflow-hidden">
        {loading ? (
          <LoadingRows rows={4} />
        ) : clients.length === 0 ? (
          <EmptyState
            icon={Users}
            title={searchDebounced ? 'Aramanızla eşleşen danışan yok' : 'Henüz danışan eklenmemiş'}
            hint={searchDebounced ? 'Farklı bir ad veya telefon deneyin.' : 'İlk danışanınızı ekleyerek başlayın.'}
            action={
              searchDebounced ? null : (
                <Button onClick={() => setIsModalOpen(true)}>
                  <Plus />
                  İlk danışanı ekle
                </Button>
              )
            }
          />
        ) : (
          <>
            <table className="hidden w-full border-collapse text-sm md:table">
              <thead>
                <tr className="border-0 border-b border-solid bg-muted/50 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Danışan</th>
                  <th className="px-5 py-3 font-medium">Telefon</th>
                  <th className="px-5 py-3 font-medium">Doğum tarihi</th>
                  <th className="px-5 py-3 font-medium">Kayıt</th>
                  <th className="w-12 px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr
                    key={client.id}
                    onClick={() => navigate(`/client/${client.id}`)}
                    className="cursor-pointer border-0 border-b border-solid transition-colors last:border-b-0 hover:bg-accent/50"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={client.name} />
                        <div className="min-w-0">
                          <div className="truncate font-medium">{client.name || 'İsimsiz'}</div>
                          <div className="truncate text-[13px] text-muted-foreground">{client.email || 'E-posta yok'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{client.phone || '–'}</td>
                    <td className="px-5 py-3 text-muted-foreground">{formatDate(client.birthDate)}</td>
                    <td className="px-5 py-3 text-muted-foreground">{formatDate(client.createdAt)}</td>
                    <td className="px-3 py-3 text-right">{rowMenu(client)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <ul className="m-0 list-none divide-y divide-border p-0 md:hidden">
              {clients.map((client) => (
                <li key={client.id} className="flex items-center gap-3 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => navigate(`/client/${client.id}`)}
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 border-0 bg-transparent p-0 text-left text-foreground [font-family:inherit]"
                  >
                    <Avatar name={client.name} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{client.name || 'İsimsiz'}</span>
                      <span className="flex items-center gap-1 truncate text-[13px] text-muted-foreground">
                        {client.phone ? (
                          <>
                            <Phone className="size-3" />
                            {client.phone}
                          </>
                        ) : (
                          client.email || 'İletişim bilgisi yok'
                        )}
                      </span>
                    </span>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </button>
                  {rowMenu(client)}
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <AddClientModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={loadClients} />
    </PageContainer>
  );
};
