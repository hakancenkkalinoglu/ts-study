import { useEffect, useState } from 'react';
import { getRoomAvailability, type RoomAvailability } from '../services/api';

/**
 * Seçilen tarih, saat ve sürede danışanın kliniğinin hangi odalarının dolu olduğunu getirir.
 * Klinik (kişisel danışan) ya da oda yoksa boş liste.
 */
export const useRoomAvailability = (
  active: boolean,
  clinicId: number | null | undefined,
  date: string,
  time: string,
  duration: number,
  excludeAppointmentId?: number
) => {
  const [rooms, setRooms] = useState<RoomAvailability[]>([]);
  const enabled = active && Boolean(clinicId) && Boolean(date) && Boolean(time);

  useEffect(() => {
    if (!enabled || !clinicId) return;
    let cancelled = false;
    getRoomAvailability({ clinicId, date, time, duration, excludeAppointmentId })
      .then((data) => {
        if (!cancelled) setRooms(data);
      })
      .catch(() => {
        if (!cancelled) setRooms([]);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, clinicId, date, time, duration, excludeAppointmentId]);

  return enabled ? rooms : [];
};
