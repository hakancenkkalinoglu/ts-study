import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getMyClinics, setActiveClinicId } from '../services/api';
import type { Clinic } from '../types';

const ACTIVE_CLINIC_KEY = 'testpsikolog_active_clinic';

type ClinicContextValue = {
  /** Kullanıcının üye olduğu tüm klinikler (kliniği yoksa boş). */
  clinics: Clinic[];
  /** Klinik sayfası, rapor ve klinik takvimi bu kliniği gösterir. Kliniği yoksa null. */
  activeClinic: Clinic | null;
  loaded: boolean;
  /** Aktif kliniği değiştirir; sayfalar yeni klinikle yeniden yüklenir. */
  selectClinic: (id: number) => void;
  /** Klinik listesini yeniden çeker. selectId verilirse (yeni kurulan/katılınan klinik) o aktif olur. */
  reload: (selectId?: number | null) => Promise<void>;
};

const ClinicContext = createContext<ClinicContextValue | null>(null);

const readStoredId = (): number | null => {
  try {
    const raw = localStorage.getItem(ACTIVE_CLINIC_KEY);
    const value = raw ? Number(raw) : NaN;
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
};

const storeId = (id: number | null) => {
  try {
    if (id == null) localStorage.removeItem(ACTIVE_CLINIC_KEY);
    else localStorage.setItem(ACTIVE_CLINIC_KEY, String(id));
  } catch {
    // tarayıcı depolaması yoksa seçim yalnızca oturum boyunca kalır
  }
};

/** Kayıtlı seçim listede yoksa (ayrıldı, silindi) ilk kliniğe düşer; klinik yoksa null. */
const pickActive = (clinics: Clinic[], preferred: number | null): number | null => {
  if (preferred != null && clinics.some((clinic) => clinic.id === preferred)) return preferred;
  return clinics[0]?.id ?? null;
};

export const ClinicProvider = ({ children }: { children: ReactNode }) => {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [activeId, setActiveId] = useState<number | null>(() => readStoredId());
  const [loaded, setLoaded] = useState(false);

  // Sayfalar çizilmeden önce api katmanı doğru aktif klinikle çalışmalı (istekleri onlar atar).
  setActiveClinicId(activeId);

  const apply = useCallback((list: Clinic[], preferred: number | null) => {
    const next = pickActive(list, preferred);
    setActiveClinicId(next);
    storeId(next);
    setClinics(list);
    setActiveId(next);
  }, []);

  const reload = useCallback(
    async (selectId?: number | null) => {
      try {
        const list = await getMyClinics();
        apply(list, selectId ?? activeId);
      } catch {
        // klinik listesi alınamazsa mevcut durum korunur
      } finally {
        setLoaded(true);
      }
    },
    [apply, activeId]
  );

  useEffect(() => {
    void reload();
    // yalnızca ilk yüklemede
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectClinic = useCallback(
    (id: number) => {
      if (!clinics.some((clinic) => clinic.id === id)) return;
      setActiveClinicId(id);
      storeId(id);
      setActiveId(id);
    },
    [clinics]
  );

  const value = useMemo<ClinicContextValue>(
    () => ({
      clinics,
      activeClinic: clinics.find((clinic) => clinic.id === activeId) ?? null,
      loaded,
      selectClinic,
      reload,
    }),
    [clinics, activeId, loaded, selectClinic, reload]
  );

  // Aktif klinik belli olmadan sayfaları çizme: ilk istekler yanlış klinikle gitmesin.
  if (!loaded) return null;
  return <ClinicContext.Provider value={value}>{children}</ClinicContext.Provider>;
};

export const useClinics = (): ClinicContextValue => {
  const value = useContext(ClinicContext);
  if (!value) throw new Error('useClinics, ClinicProvider içinde kullanılmalı.');
  return value;
};
