import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getClients, deleteClient } from '../services/api';
import type { Client } from '../types';
import { AddClientModal } from '../components/AddClientModal';
import './ClientsList.css';

export const ClientsList = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      setLoading(true);
      const data = await getClients();
      setClients(data);
    } catch (error) {
      console.error('Error loading clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Bu danışanı silmek istediğinize emin misiniz?')) {
      try {
        await deleteClient(id);
        loadClients();
      } catch (error) {
        console.error('Error deleting client:', error);
        alert('Danışan silinirken bir hata oluştu.');
      }
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('tr-TR');
  };

  if (loading) {
    return (
      <div className="clients-container">
        <div className="loading">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="clients-container">
      <div className="clients-header">
        <h1>Danışanlar</h1>
        <button className="add-button" onClick={() => setIsModalOpen(true)}>
          + Yeni Danışan Ekle
        </button>
      </div>

      {clients.length === 0 ? (
        <div className="empty-state">
          <p>Henüz danışan eklenmemiş.</p>
          <button className="add-button" onClick={() => setIsModalOpen(true)}>
            İlk Danışanı Ekle
          </button>
        </div>
      ) : (
        <div className="table-container">
          <table className="clients-table">
            <thead>
              <tr>
                <th>Ad Soyad</th>
                <th>E-posta</th>
                <th>Doğum Tarihi</th>
                <th>Kayıt Tarihi</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr
                  key={client.id}
                  onClick={() => navigate(`/client/${client.id}`)}
                  className="table-row"
                >
                  <td>{client.name || '-'}</td>
                  <td>{client.email}</td>
                  <td>{formatDate(client.birthDate)}</td>
                  <td>{formatDate(client.createdAt)}</td>
                  <td>
                    <button
                      className="delete-button"
                      onClick={(e) => handleDelete(client.id, e)}
                    >
                      Sil
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AddClientModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={loadClients}
      />
    </div>
  );
};
