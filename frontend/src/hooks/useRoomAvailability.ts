import { useEffect, useState } from 'react';
import { getRoomAvailability, type RoomAvailability } from '../services/api';

/** Seçilen tarih, saat ve sürede kliniğin hangi odalarının dolu olduğunu getirir. Klinik/oda yoksa boş liste. */
export const useRoomAvailability = (
  active: boolean,
  date: string,
  time: string,
  duration: number,
  excludeAppointmentId?: number
) => {
  const [rooms, setRooms] = useState<RoomAvailability[]>([]);

  useEffect(() => {
    if (!active || !date || !time) return;
    let cancelled = false;
    getRoomAvailability({ date, time, duration, excludeAppointmentId })
      .then((data) => {
        if (!cancelled) setRooms(data);
      })
      .catch(() => {
        if (!cancelled) setRooms([]);
      });
    return () => {
      cancelled = true;
    };
  }, [active, date, time, duration, excludeAppointmentId]);

  return rooms;
};
