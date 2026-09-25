import type { RoomAvailability } from '../services/api';

export const roomLabel = (name: string, busy: boolean) => (busy ? `${name} (dolu)` : name);

/** Oda alanının altındaki ipucu: seçilen saatte hangi odalar boş. */
export const roomHint = (availability: RoomAvailability[], selectedRoomId: number): string | undefined => {
  if (availability.length === 0) return undefined;
  const selected = availability.find((room) => room.id === selectedRoomId);
  if (selected?.busy) return `${selected.name} bu saatte dolu, başka bir oda seçin.`;
  const free = availability.filter((room) => !room.busy).map((room) => room.name);
  return free.length === 0 ? 'Bu saatte boş oda yok.' : `Bu saatte boş: ${free.join(', ')}`;
};
