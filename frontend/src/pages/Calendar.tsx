import { useState, useEffect, useCallback, useRef } from 'react';
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addDays,
  subDays,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
} from 'date-fns';
import { tr } from 'date-fns/locale';
import {
  apiErrorMessage,
  getAllAppointments,
  getBlockedSlots,
  getMyClinic,
  updateAppointment,
  updateBlockedSlot,
} from '../services/api';
import type { AppointmentWithClient, BlockedSlot, Clinic } from '../types';
import { AddAppointmentModal } from '../components/AddAppointmentModal';
import { BlockedSlotModal, type BlockedSlotModalState } from '../components/BlockedSlotModal';
import { UpdateAppointmentModal } from '../components/UpdateAppointmentModal';
import { appointmentStatus, sessionDuration, therapistColor } from '../types';
import { useToast } from '../contexts/ToastContext';
import { useClinics } from '../contexts/ClinicContext';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { CalendarPlus, ChevronLeft, ChevronRight, DoorOpen, Lock, Plus, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent } from '@/components/ui/dialog';
import { NativeSelect } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import './Calendar.css';

type ViewMode = 'day' | 'week' | 'month';
type CalendarScope = 'mine' | 'clinic';

type DragKind = 'appointment' | 'blocked';

type DragDraft = {
  kind: DragKind;
  id: number;
  mode: 'move' | 'resize';
  date: string;
  startMinutes: number;
  duration: number;
};

const clinicSafeLabel = (apt: AppointmentWithClient): string => {
  if (apt.mine === false) {
    return apt.roomName || apt.title || 'Seans';
  }
  return apt.clientName || apt.title || 'Randevu';
};

const CALENDAR_STATE_KEY = 'calendarViewState';

type StoredCalendarState = {
  viewMode: ViewMode;
  calendarScope: CalendarScope;
  roomFilter: number;
  currentDate: string;
};

const parseStoredDate = (value?: string) => {
  if (!value) return new Date();
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day);
};

const readCalendarState = (): StoredCalendarState | null => {
  try {
    const raw = localStorage.getItem(CALENDAR_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredCalendarState>;
    const viewMode =
      parsed.viewMode === 'day' || parsed.viewMode === 'week' || parsed.viewMode === 'month'
        ? parsed.viewMode
        : null;
    if (!viewMode) return null;
    return {
      viewMode,
      calendarScope: parsed.calendarScope === 'clinic' ? 'clinic' : 'mine',
      roomFilter: typeof parsed.roomFilter === 'number' ? parsed.roomFilter : 0,
      currentDate: parsed.currentDate || format(new Date(), 'yyyy-MM-dd'),
    };
  } catch {
    return null;
  }
};

const GRID_START_HOUR = 0;
const GRID_END_HOUR = 24;
const HOUR_PX = 72;
const DAY_MINUTES = 24 * 60;

const parseTimeMinutes = (time: string | null) => {
  const part = (time || '09:00').slice(0, 5);
  const [hour, minute] = part.split(':').map(Number);
  return (hour || 0) * 60 + (minute || 0);
};

const minutesToTime = (total: number) => {
  const clamped = Math.max(0, Math.min(DAY_MINUTES - 1, total));
  const hour = Math.floor(clamped / 60);
  const minute = clamped % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

const appointmentEndMinutes = (apt: AppointmentWithClient) =>
  parseTimeMinutes(apt.appointmentTime) + sessionDuration(apt.durationMinutes);

const formatHourLabel = (hour: number) => `${String(hour).padStart(2, '0')}:00`;

const resolveGridRange = () => ({
  startMinutes: GRID_START_HOUR * 60,
  endMinutes: GRID_END_HOUR * 60,
});

type LaidOutAppointment = {
  apt: AppointmentWithClient;
  start: number;
  end: number;
  col: number;
  cols: number;
};

const layoutDayAppointments = (apts: AppointmentWithClient[]): LaidOutAppointment[] => {
  const items: LaidOutAppointment[] = apts
    .map((apt) => {
      const start = parseTimeMinutes(apt.appointmentTime);
      return { apt, start, end: appointmentEndMinutes(apt), col: 0, cols: 1 };
    })
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const columnEnds: number[] = [];
  for (const item of items) {
    let placed = false;
    for (let index = 0; index < columnEnds.length; index += 1) {
      if (columnEnds[index] <= item.start) {
        item.col = index;
        columnEnds[index] = item.end;
        placed = true;
        break;
      }
    }
    if (!placed) {
      item.col = columnEnds.length;
      columnEnds.push(item.end);
    }
  }

  for (const item of items) {
    const overlapping = items.filter((other) => other.start < item.end && other.end > item.start);
    item.cols = Math.max(...overlapping.map((other) => other.col), item.col) + 1;
  }
  return items;
};

const snapMinutes = (value: number, step: number) => Math.round(value / step) * step;

const CREATE_SNAP = 15;

const minutesFromClientY = (gridTop: number, clientY: number, step: number) => {
  const { startMinutes } = resolveGridRange();
  const raw = startMinutes + ((clientY - gridTop) / HOUR_PX) * 60;
  return Math.max(0, Math.min(DAY_MINUTES, snapMinutes(raw, step)));
};

const rangeFromOrigin = (originMinutes: number, pointerMinutes: number) => {
  const start = Math.min(originMinutes, pointerMinutes);
  let end = Math.max(originMinutes, pointerMinutes);
  if (end <= start) {
    end = start + CREATE_SNAP;
  }
  end = Math.min(DAY_MINUTES, Math.min(start + 240, end));
  const duration = Math.max(15, end - start);
  return { startMinutes: start, duration: Math.min(duration, DAY_MINUTES - start) };
};

const visibleRange = (viewMode: ViewMode, currentDate: Date) => {
  if (viewMode === 'day') {
    const day = format(currentDate, 'yyyy-MM-dd');
    return { from: day, to: day };
  }
  if (viewMode === 'week') {
    return {
      from: format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
      to: format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
    };
  }
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  return {
    from: format(startOfWeek(monthStart, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
    to: format(endOfWeek(monthEnd, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
  };
};

export const Calendar = () => {
  const { showToast } = useToast();
  const { clinics } = useClinics();
  const chooserRef = useRef<HTMLDivElement>(null);
  const [currentDate, setCurrentDate] = useState(() => parseStoredDate(readCalendarState()?.currentDate));
  const [viewMode, setViewMode] = useState<ViewMode>(
    () => readCalendarState()?.viewMode ?? (window.innerWidth < 768 ? 'day' : 'month')
  );
  const [appointments, setAppointments] = useState<AppointmentWithClient[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addModalDate, setAddModalDate] = useState<string | undefined>();
  const [addModalTime, setAddModalTime] = useState<string | undefined>();
  const [addModalDuration, setAddModalDuration] = useState<number | undefined>();
  const [now, setNow] = useState(() => new Date());
  const timeGridRef = useRef<HTMLDivElement>(null);
  const autoScrollToNowKey = useRef<string | null>(null);
  const [updateModalAppointment, setUpdateModalAppointment] =
    useState<AppointmentWithClient | null>(null);
  const [peekAppointment, setPeekAppointment] = useState<AppointmentWithClient | null>(null);
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [calendarScope, setCalendarScope] = useState<CalendarScope>(
    () => readCalendarState()?.calendarScope ?? 'mine'
  );
  const [roomFilter, setRoomFilter] = useState<number | 0>(() => readCalendarState()?.roomFilter ?? 0);
  const [slotChooser, setSlotChooser] = useState<{
    day: Date;
    time: string;
    duration: number;
    x: number;
    y: number;
  } | null>(null);
  const [blockedSlotModal, setBlockedSlotModal] = useState<BlockedSlotModalState>(null);
  const [createPreview, setCreatePreview] = useState<{
    dayKey: string;
    startMinutes: number;
    duration: number;
  } | null>(null);
  const [dragDraft, setDragDraft] = useState<DragDraft | null>(null);
  const dragSession = useRef<{
    kind: DragKind;
    apt?: AppointmentWithClient;
    blocked?: BlockedSlot;
    mode: 'move' | 'resize';
    originX: number;
    originY: number;
    moved: boolean;
    startMinutes: number;
    duration: number;
    date: string;
    gridTop: number;
    days: Date[];
    draft: DragDraft;
  } | null>(null);
  const suppressClick = useRef(false);
  const createRangeRef = useRef<{
    day: Date;
    originMinutes: number;
    gridTop: number;
    originX: number;
    originY: number;
    moved: boolean;
    startMinutes: number;
    duration: number;
  } | null>(null);
  useFocusTrap(Boolean(slotChooser), chooserRef);

  const loadAppointments = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    const range = visibleRange(viewMode, currentDate);
    if (!silent) {
      setLoading(true);
    }
    try {
      const [data, blocked] = await Promise.all([
        getAllAppointments(calendarScope, range),
        getBlockedSlots(range.from, range.to).catch(() => [] as BlockedSlot[]),
      ]);
      setAppointments(data);
      setBlockedSlots(blocked);
    } catch (error) {
      console.error('Error loading appointments:', error);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
    try {
      setClinic(await getMyClinic());
    } catch (error) {
      console.error('Error loading clinic:', error);
    }
  }, [calendarScope, viewMode, currentDate]);

  useEffect(() => {
    void loadAppointments();
  }, [loadAppointments]);

  useEffect(() => {
    const next: StoredCalendarState = {
      viewMode,
      calendarScope,
      roomFilter,
      currentDate: format(currentDate, 'yyyy-MM-dd'),
    };
    localStorage.setItem(CALENDAR_STATE_KEY, JSON.stringify(next));
  }, [viewMode, calendarScope, roomFilter, currentDate]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (loading || viewMode === 'month' || !timeGridRef.current) return;
    const scrollKey = `${viewMode}:${format(currentDate, 'yyyy-MM-dd')}`;
    if (autoScrollToNowKey.current === scrollKey) {
      return;
    }
    const today = new Date();
    const days =
      viewMode === 'day'
        ? [currentDate]
        : eachDayOfInterval({
            start: startOfWeek(currentDate, { weekStartsOn: 1 }),
            end: endOfWeek(currentDate, { weekStartsOn: 1 }),
          });
    if (!days.some((day) => isSameDay(day, today))) {
      autoScrollToNowKey.current = scrollKey;
      return;
    }
    const { startMinutes } = resolveGridRange();
    const nowMin = today.getHours() * 60 + today.getMinutes();
    timeGridRef.current.scrollTop = Math.max(0, ((nowMin - startMinutes) / 60) * HOUR_PX - 160);
    autoScrollToNowKey.current = scrollKey;
  }, [loading, viewMode, currentDate]);

  useEffect(() => {
    if (loading) return;
    const pending = sessionStorage.getItem('pendingMeetAppointmentId');
    if (!pending) return;
    const google = new URLSearchParams(window.location.search).get('google');
    if (google === 'success') {
      const apt = appointments.find((a) => String(a.id) === pending);
      if (apt) {
        setUpdateModalAppointment(apt);
      }
    }
    sessionStorage.removeItem('pendingMeetAppointmentId');
  }, [loading, appointments]);

  const goPrev = () => {
    if (viewMode === 'day') setCurrentDate((d) => subDays(d, 1));
    else if (viewMode === 'week') setCurrentDate((d) => subWeeks(d, 1));
    else setCurrentDate((d) => subMonths(d, 1));
  };

  const goNext = () => {
    if (viewMode === 'day') setCurrentDate((d) => addDays(d, 1));
    else if (viewMode === 'week') setCurrentDate((d) => addWeeks(d, 1));
    else setCurrentDate((d) => addMonths(d, 1));
  };

  const goToday = () => setCurrentDate(new Date());

  const displayAppointment = (apt: AppointmentWithClient): AppointmentWithClient => {
    if (!dragDraft || dragDraft.kind !== 'appointment' || dragDraft.id !== apt.id) {
      return apt;
    }
    return {
      ...apt,
      appointmentDate: dragDraft.date,
      appointmentTime: minutesToTime(dragDraft.startMinutes),
      durationMinutes: dragDraft.duration,
    };
  };

  const displayBlockedSlot = (slot: BlockedSlot): BlockedSlot => {
    if (!dragDraft || dragDraft.kind !== 'blocked' || dragDraft.id !== slot.id) {
      return slot;
    }
    const endMinutes = dragDraft.startMinutes + dragDraft.duration;
    return {
      ...slot,
      slotDate: dragDraft.date,
      startTime: minutesToTime(dragDraft.startMinutes),
      endTime: minutesToTime(endMinutes),
    };
  };

  const getAppointmentsForDate = (date: Date) => {
    const dayStr = format(date, 'yyyy-MM-dd');
    const apts = appointments
      .map(displayAppointment)
      .filter((apt) => {
        const aptDate = apt.appointmentDate.includes('T')
          ? apt.appointmentDate.split('T')[0]
          : apt.appointmentDate;
        return aptDate === dayStr;
      });
    const filtered = roomFilter
      ? apts.filter((apt) => apt.roomId === roomFilter)
      : apts;
    return [...filtered].sort((a, b) => {
      const timeA = a.appointmentTime || '00:00';
      const timeB = b.appointmentTime || '00:00';
      return timeA.localeCompare(timeB);
    });
  };

  const getBlockedForDate = (date: Date) => {
    const dayStr = format(date, 'yyyy-MM-dd');
    return blockedSlots
      .map(displayBlockedSlot)
      .filter((slot) => slot.slotDate.slice(0, 10) === dayStr);
  };

  const formatTime = (time: string | null) => (time || '09:00').slice(0, 5);

  const openAddModal = (date?: Date, time?: string, duration?: number) => {
    setAddModalDate(date ? format(date, 'yyyy-MM-dd') : undefined);
    setAddModalTime(time);
    setAddModalDuration(duration);
    setAddModalOpen(true);
  };

  const openUpdateModal = (apt: AppointmentWithClient) => {
    if (apt.mine === false) {
      setPeekAppointment(apt);
      return;
    }
    setUpdateModalAppointment(apt);
  };

  const dayFromClientX = (clientX: number, days: Date[]) => {
    const columns = timeGridRef.current?.querySelectorAll<HTMLElement>('[data-cal-day]');
    if (!columns) return null;
    for (const column of columns) {
      const rect = column.getBoundingClientRect();
      if (clientX >= rect.left && clientX <= rect.right) {
        const value = column.dataset.calDay;
        const match = days.find((day) => format(day, 'yyyy-MM-dd') === value);
        if (match) return match;
      }
    }
    return null;
  };

  const finishDrag = async () => {
    const session = dragSession.current;
    dragSession.current = null;
    setDragDraft(null);
    if (!session || !session.moved) {
      return;
    }
    const draft = session.draft;
    suppressClick.current = true;
    window.setTimeout(() => {
      suppressClick.current = false;
    }, 200);
    const nextTime = minutesToTime(draft.startMinutes);
    const nextDate = draft.date;
    const nextDuration = draft.duration;
    if (session.kind === 'blocked' && session.blocked) {
      const slot = session.blocked;
      const sameDate = slot.slotDate.slice(0, 10) === nextDate;
      const sameTime = formatTime(slot.startTime) === nextTime;
      const sameDuration = parseTimeMinutes(slot.endTime) - parseTimeMinutes(slot.startTime) === nextDuration;
      if (sameTime && sameDate && sameDuration) {
        return;
      }
      try {
        await updateBlockedSlot(slot.id, {
          slotDate: nextDate,
          startTime: nextTime,
          endTime: minutesToTime(nextDuration + draft.startMinutes),
          title: slot.title ?? undefined,
        });
        await loadAppointments({ silent: true });
      } catch (error) {
        showToast(apiErrorMessage(error, 'Kapalı saat taşınamadı.'), 'error');
        await loadAppointments({ silent: true });
      }
      return;
    }
    if (!session.apt) {
      return;
    }
    const sameTime = formatTime(session.apt.appointmentTime) === nextTime;
    const sameDate =
      (session.apt.appointmentDate.includes('T')
        ? session.apt.appointmentDate.split('T')[0]
        : session.apt.appointmentDate) === nextDate;
    const sameDuration = sessionDuration(session.apt.durationMinutes) === nextDuration;
    if (sameTime && sameDate && sameDuration) {
      return;
    }
    try {
      await updateAppointment(session.apt.clientId, session.apt.id, {
        appointmentDate: nextDate,
        appointmentTime: nextTime,
        durationMinutes: nextDuration,
      });
      await loadAppointments({ silent: true });
    } catch (error) {
      showToast(apiErrorMessage(error, 'Randevu taşınamadı.'), 'error');
      await loadAppointments({ silent: true });
    }
  };

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const creating = createRangeRef.current;
      if (creating) {
        const dx = event.clientX - creating.originX;
        const dy = event.clientY - creating.originY;
        if (!creating.moved && Math.hypot(dx, dy) < 6) {
          return;
        }
        creating.moved = true;
        const pointerMinutes = minutesFromClientY(creating.gridTop, event.clientY, CREATE_SNAP);
        const range = rangeFromOrigin(creating.originMinutes, pointerMinutes);
        creating.startMinutes = range.startMinutes;
        creating.duration = range.duration;
        setCreatePreview({
          dayKey: format(creating.day, 'yyyy-MM-dd'),
          startMinutes: range.startMinutes,
          duration: range.duration,
        });
        return;
      }
      const session = dragSession.current;
      if (!session) return;
      const dx = event.clientX - session.originX;
      const dy = event.clientY - session.originY;
      if (!session.moved && Math.hypot(dx, dy) < 6) {
        return;
      }
      session.moved = true;
      const { startMinutes } = resolveGridRange();
      const entityId =
        session.kind === 'appointment' ? session.apt?.id : session.blocked?.id;
      if (entityId == null) {
        return;
      }
      if (session.mode === 'resize') {
        const offsetY = event.clientY - session.gridTop;
        const endMinutes = snapMinutes(startMinutes + (offsetY / HOUR_PX) * 60, 5);
        const maxDuration =
          session.kind === 'appointment'
            ? Math.min(240, DAY_MINUTES - session.startMinutes)
            : DAY_MINUTES - session.startMinutes;
        const duration = Math.max(15, Math.min(maxDuration, endMinutes - session.startMinutes));
        session.draft = {
          kind: session.kind,
          id: entityId,
          mode: 'resize',
          date: session.date,
          startMinutes: session.startMinutes,
          duration,
        };
        setDragDraft({ ...session.draft });
        return;
      }
      const targetDay = dayFromClientX(event.clientX, session.days) ?? parseStoredDate(session.date);
      const offsetY = event.clientY - session.gridTop;
      const moveSnap = session.kind === 'blocked' ? CREATE_SNAP : 30;
      const rawStart = snapMinutes(startMinutes + (offsetY / HOUR_PX) * 60, moveSnap);
      const maxStart = Math.max(0, DAY_MINUTES - session.duration);
      const nextStart = Math.max(0, Math.min(maxStart, rawStart));
      session.draft = {
        kind: session.kind,
        id: entityId,
        mode: 'move',
        date: format(targetDay, 'yyyy-MM-dd'),
        startMinutes: nextStart,
        duration: session.duration,
      };
      setDragDraft({ ...session.draft });
    };
    const onUp = (event: PointerEvent) => {
      const creating = createRangeRef.current;
      if (creating) {
        createRangeRef.current = null;
        setCreatePreview(null);
        const duration = creating.moved ? creating.duration : 30;
        const startMinutes = creating.moved ? creating.startMinutes : creating.originMinutes;
        suppressClick.current = true;
        window.setTimeout(() => {
          suppressClick.current = false;
        }, 200);
        setSlotChooser({
          day: creating.day,
          time: minutesToTime(startMinutes),
          duration,
          x: event.clientX,
          y: event.clientY,
        });
        return;
      }
      if (!dragSession.current) return;
      void finishDrag();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [loadAppointments, showToast]);

  const startDrag = (
    apt: AppointmentWithClient,
    mode: 'move' | 'resize',
    event: React.PointerEvent,
    days: Date[]
  ) => {
    if (apt.mine === false) return;
    const column = (event.currentTarget as HTMLElement).closest('[data-cal-day]') as HTMLElement | null;
    const gridTop = column?.getBoundingClientRect().top ?? 0;
    const date = apt.appointmentDate.includes('T') ? apt.appointmentDate.split('T')[0] : apt.appointmentDate;
    const startMinutes = parseTimeMinutes(apt.appointmentTime);
    const duration = sessionDuration(apt.durationMinutes);
    const draft: DragDraft = {
      kind: 'appointment',
      id: apt.id,
      mode,
      date,
      startMinutes,
      duration,
    };
    dragSession.current = {
      kind: 'appointment',
      apt,
      mode,
      originX: event.clientX,
      originY: event.clientY,
      moved: false,
      startMinutes,
      duration,
      date,
      gridTop,
      days,
      draft,
    };
    setDragDraft(draft);
  };

  const startBlockedDrag = (
    slot: BlockedSlot,
    mode: 'move' | 'resize',
    event: React.PointerEvent,
    days: Date[]
  ) => {
    event.stopPropagation();
    if (mode === 'resize') {
      event.preventDefault();
    }
    const column = (event.currentTarget as HTMLElement).closest('[data-cal-day]') as HTMLElement | null;
    const gridTop = column?.getBoundingClientRect().top ?? 0;
    const date = slot.slotDate.slice(0, 10);
    const startMinutes = parseTimeMinutes(slot.startTime);
    const duration = Math.max(15, parseTimeMinutes(slot.endTime) - startMinutes);
    const draft: DragDraft = {
      kind: 'blocked',
      id: slot.id,
      mode,
      date,
      startMinutes,
      duration,
    };
    dragSession.current = {
      kind: 'blocked',
      blocked: slot,
      mode,
      originX: event.clientX,
      originY: event.clientY,
      moved: false,
      startMinutes,
      duration,
      date,
      gridTop,
      days,
      draft,
    };
    setDragDraft(draft);
  };

  const handleBlockedPointerDown = (slot: BlockedSlot, event: React.PointerEvent, days: Date[]) => {
    startBlockedDrag(slot, 'move', event, days);
  };

  const handleBlockedResizePointerDown = (slot: BlockedSlot, event: React.PointerEvent, days: Date[]) => {
    startBlockedDrag(slot, 'resize', event, days);
  };

  const handleCardPointerDown = (
    apt: AppointmentWithClient,
    event: React.PointerEvent,
    days: Date[]
  ) => {
    event.stopPropagation();
    startDrag(apt, 'move', event, days);
  };

  const handleResizePointerDown = (
    apt: AppointmentWithClient,
    event: React.PointerEvent,
    days: Date[]
  ) => {
    event.stopPropagation();
    event.preventDefault();
    startDrag(apt, 'resize', event, days);
  };

  const handleColumnPointerDown = (day: Date, event: React.PointerEvent<HTMLDivElement>) => {
    if (suppressClick.current || dragSession.current) return;
    const target = event.target as HTMLElement;
    if (target.closest('.time-event, .time-blocked')) return;
    const gridTop = event.currentTarget.getBoundingClientRect().top;
    const originMinutes = minutesFromClientY(gridTop, event.clientY, CREATE_SNAP);
    createRangeRef.current = {
      day,
      originMinutes,
      gridTop,
      originX: event.clientX,
      originY: event.clientY,
      moved: false,
      startMinutes: originMinutes,
      duration: 30,
    };
  };

  const handleCardClick = (apt: AppointmentWithClient, event: React.MouseEvent) => {
    event.stopPropagation();
    if (suppressClick.current || dragSession.current?.moved) {
      return;
    }
    openUpdateModal(apt);
  };

  const closeSlotChooser = () => setSlotChooser(null);

  const openBlockedSlotModal = (day: Date, time: string, duration: number) => {
    closeSlotChooser();
    setBlockedSlotModal({
      mode: 'create',
      slotDate: format(day, 'yyyy-MM-dd'),
      startTime: time,
      durationMinutes: duration,
    });
  };

  useEffect(() => {
    setSlotChooser(null);
    setBlockedSlotModal(null);
    setCreatePreview(null);
    createRangeRef.current = null;
  }, [viewMode, currentDate]);

  useEffect(() => {
    if (!slotChooser) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeSlotChooser();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [slotChooser]);

  const handleBlockedClick = (slot: BlockedSlot, event: React.MouseEvent) => {
    event.stopPropagation();
    if (suppressClick.current || dragSession.current?.moved) {
      return;
    }
    setBlockedSlotModal({ mode: 'edit', slot });
  };

  const cardStyle = (apt: AppointmentWithClient) => {
    // Başka klinikteki ya da kişisel randevu bu klinikte yalnızca gri "Kapalı" bloğu olarak görünür.
    if (apt.mine === false && !apt.roomId && apt.title === 'Kapalı') {
      return { background: 'var(--muted-foreground)' };
    }
    const room = apt.roomColor || undefined;
    const therapist = therapistColor(apt.therapistUserId);
    const background = room || therapist;
    if (!background) return undefined;
    return {
      background,
      borderLeft: therapist && room ? `4px solid ${therapist}` : undefined,
    };
  };

  const getTitle = () => {
    if (viewMode === 'day') {
      return format(currentDate, 'd MMMM yyyy', { locale: tr });
    }
    if (viewMode === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      return `${format(start, 'd MMM', { locale: tr })} - ${format(end, 'd MMMM yyyy', { locale: tr })}`;
    }
    return format(currentDate, 'MMMM yyyy', { locale: tr });
  };

  const renderTimeGrid = (days: Date[]) => {
    const { startMinutes, endMinutes } = resolveGridRange();
    const hours: number[] = [];
    for (let hour = startMinutes / 60; hour < endMinutes / 60; hour += 1) {
      hours.push(hour);
    }
    const gridHeight = ((endMinutes - startMinutes) / 60) * HOUR_PX;
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const nowTop = ((nowMinutes - startMinutes) / 60) * HOUR_PX;
    const showNow = nowMinutes >= startMinutes && nowMinutes <= endMinutes;

    return (
      <div className={cn('time-grid', days.length > 1 && 'is-week')}>
        <div
          className="time-grid-header"
          style={{ gridTemplateColumns: `64px repeat(${days.length}, minmax(0, 1fr))` }}
        >
          <div className="time-grid-gutter-head" />
          {days.map((day) => (
            <button
              key={`${day.toISOString()}-head`}
              type="button"
              className={`time-grid-day-head ${isSameDay(day, now) ? 'is-today' : ''}`}
              onClick={() => openAddModal(day)}
            >
              <span className="time-grid-day-name">{format(day, 'EEE', { locale: tr })}</span>
              <span className="time-grid-day-num">{format(day, 'd')}</span>
            </button>
          ))}
        </div>
        <div className="time-grid-scroll" ref={timeGridRef}>
          <div
            className="time-grid-body"
            style={{
              gridTemplateColumns: `64px repeat(${days.length}, minmax(0, 1fr))`,
              height: gridHeight,
            }}
          >
            <div className="time-grid-gutter">
              {hours.map((hour) => (
                <div key={hour} className="time-hour-label" style={{ height: HOUR_PX }}>
                  {formatHourLabel(hour)}
                </div>
              ))}
              <div className="time-hour-label time-hour-label-end">{formatHourLabel(endMinutes / 60)}</div>
            </div>
            {days.map((day) => {
              const laidOut = layoutDayAppointments(getAppointmentsForDate(day));
              const blocked = getBlockedForDate(day);
              const isToday = isSameDay(day, now);
              const dayKey = format(day, 'yyyy-MM-dd');
              return (
                <div
                  key={day.toISOString()}
                  className={`time-day-col ${isToday ? 'is-today' : ''}`}
                  style={{ height: gridHeight }}
                  data-cal-day={dayKey}
                  onPointerDown={(event) => handleColumnPointerDown(day, event)}
                  role="presentation"
                >
                  {hours.map((hour) => (
                    <div key={hour} className="time-hour-line" style={{ height: HOUR_PX }} />
                  ))}
                  {createPreview && createPreview.dayKey === dayKey ? (
                    <div
                      className="time-create-preview"
                      style={{
                        top: ((createPreview.startMinutes - startMinutes) / 60) * HOUR_PX,
                        height: Math.max((createPreview.duration / 60) * HOUR_PX - 2, 16),
                      }}
                    >
                      {minutesToTime(createPreview.startMinutes)} · {createPreview.duration} dk
                    </div>
                  ) : null}
                  {blocked.map((slot) => {
                    const start = parseTimeMinutes(slot.startTime);
                    const end = parseTimeMinutes(slot.endTime);
                    const top = ((start - startMinutes) / 60) * HOUR_PX;
                    const height = Math.max(((end - start) / 60) * HOUR_PX - 2, 16);
                    const dragging = dragDraft?.kind === 'blocked' && dragDraft.id === slot.id;
                    return (
                      <div
                        key={slot.id}
                        className={cn('time-blocked', dragging && 'is-dragging')}
                        style={{ top, height }}
                        title={`${formatTime(slot.startTime)}–${formatTime(slot.endTime)} · ${slot.title || 'Kapalı'}`}
                        onPointerDown={(event) => handleBlockedPointerDown(slot, event, days)}
                        onClick={(event) => handleBlockedClick(slot, event)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            setBlockedSlotModal({ mode: 'edit', slot });
                          }
                        }}
                      >
                        <span className="time-blocked-label">{slot.title || 'Kapalı'}</span>
                        <span
                          className="time-blocked-resize"
                          onPointerDown={(event) => handleBlockedResizePointerDown(slot, event, days)}
                        />
                      </div>
                    );
                  })}
                  {laidOut.map((item) => {
                    const top = ((item.start - startMinutes) / 60) * HOUR_PX;
                    const height = Math.max(((item.end - item.start) / 60) * HOUR_PX - 2, 28);
                    const width = `calc((100% - 6px) / ${item.cols})`;
                    const left = `calc(3px + ${item.col} * (100% - 6px) / ${item.cols})`;
                    const dragging = dragDraft?.kind === 'appointment' && dragDraft.id === item.apt.id;
                    return (
                      <div
                        key={item.apt.id}
                        className={`time-event status-${appointmentStatus(item.apt.status)} ${item.apt.mine === false ? 'not-mine' : ''} ${dragging ? 'is-dragging' : ''}`}
                        style={{
                          top,
                          height,
                          width,
                          left,
                          ...cardStyle(item.apt),
                        }}
                        onPointerDown={(event) => handleCardPointerDown(item.apt, event, days)}
                        onClick={(event) => handleCardClick(item.apt, event)}
                      >
                        <span className="time-event-time">{formatTime(item.apt.appointmentTime)}</span>
                        <span className="time-event-title">{clinicSafeLabel(item.apt)}</span>
                        {item.apt.roomName ? <span className="time-event-meta">{item.apt.roomName}</span> : null}
                        {calendarScope === 'mine' && clinics.length > 1 && item.apt.clinicId ? (
                          <span className="time-event-meta">
                            {clinics.find((c) => c.id === item.apt.clinicId)?.name}
                          </span>
                        ) : null}
                        {calendarScope === 'clinic' && item.apt.therapistName ? (
                          <span className="time-event-meta">{item.apt.therapistName}</span>
                        ) : null}
                        {item.apt.mine !== false ? (
                          <span
                            className="time-event-resize"
                            onPointerDown={(event) => handleResizePointerDown(item.apt, event, days)}
                          />
                        ) : null}
                      </div>
                    );
                  })}
                  {showNow && isToday ? (
                    <div className="time-now" style={{ top: nowTop }}>
                      <span className="time-now-dot" />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderDayView = () => renderTimeGrid([currentDate]);

  const renderWeekView = () => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = endOfWeek(currentDate, { weekStartsOn: 1 });
    return renderTimeGrid(eachDayOfInterval({ start, end }));
  };

  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const start = startOfWeek(monthStart, { weekStartsOn: 1 });
    const end = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start, end });

    const weekDays = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

    return (
      <div className="calendar-month-view">
        <div className="month-weekdays">
          {weekDays.map((d) => (
            <div key={d} className="month-weekday">
              {d}
            </div>
          ))}
        </div>
        <div
          className="month-grid"
          style={{ gridTemplateRows: `repeat(${days.length / 7}, minmax(0, 1fr))` }}
        >
          {days.map((day) => {
            const apts = getAppointmentsForDate(day);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isToday = isSameDay(day, new Date());

            return (
              <div
                key={day.toISOString()}
                className={`month-day-cell ${!isCurrentMonth ? 'other-month' : ''} ${isToday ? 'today' : ''}`}
                onClick={() => openAddModal(day)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && openAddModal(day)}
              >
                <span className="month-day-num">{format(day, 'd')}</span>
                <div className="month-day-apts">
                  {apts.map((apt) => (
                    <div
                      key={apt.id}
                      className={`calendar-apt-card tiny status-${appointmentStatus(apt.status)} ${apt.mine === false ? 'not-mine' : ''}`}
                      style={cardStyle(apt)}
                      onClick={(e) => {
                        e.stopPropagation();
                        openUpdateModal(apt);
                      }}
                      title={`${formatTime(apt.appointmentTime)} · ${sessionDuration(apt.durationMinutes)} dk · ${clinicSafeLabel(apt)}${apt.mine === false ? '' : apt.title ? ` - ${apt.title}` : ''}`}
                    >
                      <span className="apt-time-tiny">{formatTime(apt.appointmentTime)}</span>
                      {clinicSafeLabel(apt)}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-[calc(100dvh-8.5rem)] flex-col px-3 py-4 md:h-screen md:px-6 md:py-5">
      <div className="mb-4 flex shrink-0 flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goPrev} aria-label="Önceki">
            <ChevronLeft />
          </Button>
          <Button variant="outline" onClick={goToday}>
            Bugün
          </Button>
          <Button variant="outline" size="icon" onClick={goNext} aria-label="Sonraki">
            <ChevronRight />
          </Button>
          <h1 className="m-0 ml-2 min-w-0 truncate text-lg font-semibold tracking-tight md:text-xl">{getTitle()}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {clinic ? (
            <>
              <SegmentedControl
                value={calendarScope}
                onChange={setCalendarScope}
                options={[
                  { value: 'mine', label: 'Ben' },
                  { value: 'clinic', label: 'Tüm klinik' },
                ]}
              />
              <NativeSelect
                className="w-auto"
                value={roomFilter}
                onChange={(e) => setRoomFilter(Number(e.target.value))}
                aria-label="Oda filtresi"
              >
                <option value={0}>Tüm odalar</option>
                {clinic.rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name}
                  </option>
                ))}
              </NativeSelect>
            </>
          ) : null}
          <SegmentedControl
            value={viewMode}
            onChange={setViewMode}
            options={[
              { value: 'day', label: 'Gün' },
              { value: 'week', label: 'Hafta' },
              { value: 'month', label: 'Ay' },
            ]}
          />
          <Button onClick={() => openAddModal(currentDate)} className="ml-auto xl:ml-0">
            <Plus />
            Randevu
          </Button>
        </div>
      </div>

      {loading && appointments.length === 0 ? (
        <div className="calendar-content items-center justify-center text-sm text-muted-foreground">Yükleniyor...</div>
      ) : (
        <div className="calendar-content">
          {viewMode === 'day' && renderDayView()}
          {viewMode === 'week' && renderWeekView()}
          {viewMode === 'month' && renderMonthView()}
        </div>
      )}

      <AddAppointmentModal
        isOpen={addModalOpen}
        onClose={() => {
          setAddModalOpen(false);
          setAddModalTime(undefined);
          setAddModalDuration(undefined);
        }}
        initialTime={addModalTime}
        initialDuration={addModalDuration}
        onSuccess={(createdAppointment) => {
          setAddModalTime(undefined);
          setAddModalDuration(undefined);
          void loadAppointments({ silent: true });
          if (createdAppointment) {
            setAddModalOpen(false);
            setUpdateModalAppointment(createdAppointment);
          }
        }}
        initialDate={addModalDate}
      />
      <UpdateAppointmentModal
        isOpen={!!updateModalAppointment}
        onClose={() => setUpdateModalAppointment(null)}
        onSuccess={() => void loadAppointments({ silent: true })}
        appointment={updateModalAppointment}
      />
      <BlockedSlotModal
        state={blockedSlotModal}
        onClose={() => setBlockedSlotModal(null)}
        onSuccess={() => void loadAppointments({ silent: true })}
      />
      {slotChooser ? (
        <div className="fixed inset-0 z-40" onClick={closeSlotChooser}>
          <div
            ref={chooserRef}
            className="fixed flex w-56 flex-col rounded-lg border border-solid bg-popover p-1 font-sans text-popover-foreground shadow-lg outline-none animate-in fade-in-0 zoom-in-95"
            role="dialog"
            aria-modal="true"
            aria-label="Saat işlemi"
            tabIndex={-1}
            style={{
              left: Math.max(8, Math.min(slotChooser.x, window.innerWidth - 232)),
              top: Math.max(8, Math.min(slotChooser.y, window.innerHeight - 140)),
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <p className="m-0 px-2.5 py-1.5 text-xs font-medium text-muted-foreground">
              {format(slotChooser.day, 'd MMMM EEEE', { locale: tr })} · {slotChooser.time} · {slotChooser.duration} dk
            </p>
            <button
              type="button"
              className="flex cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent px-2.5 py-2 text-left text-sm text-foreground [font-family:inherit] hover:bg-accent"
              onClick={() => {
                const { day, time, duration } = slotChooser;
                closeSlotChooser();
                openAddModal(day, time, duration);
              }}
            >
              <CalendarPlus className="size-4 text-muted-foreground" />
              Randevu ekle
            </button>
            <button
              type="button"
              className="flex cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent px-2.5 py-2 text-left text-sm text-foreground [font-family:inherit] hover:bg-accent"
              onClick={() => {
                openBlockedSlotModal(slotChooser.day, slotChooser.time, slotChooser.duration);
              }}
            >
              <Lock className="size-4 text-muted-foreground" />
              Bu saati kapat
            </button>
          </div>
        </div>
      ) : null}
      <Dialog open={peekAppointment !== null} onOpenChange={(open) => (open ? null : setPeekAppointment(null))}>
        {peekAppointment ? (
          <DialogContent
            title="Meslektaş seansı"
            description="Bu seans bir meslektaşınıza ait. Danışan bilgisi, notlar ve düzenleme kapalıdır."
            className="max-w-sm"
          >
            <DialogBody className="gap-3 text-sm">
              <div className="flex items-center gap-3">
                <CalendarPlus className="size-4 text-muted-foreground" />
                {format(parseStoredDate(peekAppointment.appointmentDate.slice(0, 10)), 'd MMMM EEEE', { locale: tr })} ·{' '}
                {formatTime(peekAppointment.appointmentTime)} · {sessionDuration(peekAppointment.durationMinutes)} dk
              </div>
              {peekAppointment.roomName ? (
                <div className="flex items-center gap-3">
                  <DoorOpen className="size-4 text-muted-foreground" />
                  {peekAppointment.roomName}
                </div>
              ) : null}
              {peekAppointment.therapistName ? (
                <div className="flex items-center gap-3">
                  <UserRound className="size-4 text-muted-foreground" />
                  {peekAppointment.therapistName}
                </div>
              ) : null}
            </DialogBody>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
};

const SegmentedControl = <T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) => (
  <div className="inline-flex rounded-lg border border-solid bg-muted/60 p-0.5">
    {options.map((option) => (
      <button
        key={option.value}
        type="button"
        aria-pressed={value === option.value}
        onClick={() => onChange(option.value)}
        className={cn(
          'cursor-pointer rounded-md border-0 px-3 py-1.5 text-sm font-medium [font-family:inherit] transition-colors',
          value === option.value ? 'bg-card text-foreground shadow-sm' : 'bg-transparent text-muted-foreground hover:text-foreground'
        )}
      >
        {option.label}
      </button>
    ))}
  </div>
);
