import { useNavigate } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState, PageContainer } from '@/components/ui/page';

export const NotFound = () => {
  const navigate = useNavigate();
  return (
    <PageContainer className="flex min-h-[70vh] items-center justify-center">
      <EmptyState
        icon={Compass}
        title="Sayfa bulunamadı"
        hint="Bu adres uygulamada yok. Bugün ekranına dönebilirsiniz."
        action={<Button onClick={() => navigate('/')}>Bugüne dön</Button>}
      />
    </PageContainer>
  );
};
