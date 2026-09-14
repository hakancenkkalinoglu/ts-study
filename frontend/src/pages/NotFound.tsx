import { useNavigate } from 'react-router-dom';
import './NotFound.css';

export const NotFound = () => {
  const navigate = useNavigate();
  return (
    <div className="not-found">
      <h1>Sayfa bulunamadı</h1>
      <p>Bu adres uygulamada yok. Bugün ekranına dönebilirsiniz.</p>
      <button type="button" onClick={() => navigate('/')}>
        Bugüne dön
      </button>
    </div>
  );
};
