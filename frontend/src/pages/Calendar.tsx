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
import { getAllAppointments, getMyClinic } from '../services/api';
import type { AppointmentWithClient, Clinic } from '../types';
import { AddAppointmentModal } from '../components/AddAppointmentModal';
import { UpdateAppointmentModal } from '../components/UpdateAppointmentModal';
import { appointmentStatus, sessionDuration, therapistColor } from '../types';
import './Calendar.css';
import '../components/AddClientModal.css';

type ViewMode = 'day' | 'week' | 'month';
type CalendarScope = 'mine' | 'clinic';

const clinicSafeLabel = (apt: AppointmentWithClient): string => {
  if (apt.mine === false) {
    return apt.roomName || 'Seans';
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

const GRID_START_HOUR = 7;
const GRID_END_HOUR = 23;
const HOUR_PX = 72;

const parseTimeMinutes = (time: string | null) => {
  const part = (time || '09:00').slice(0, 5);
  const [hour, minute] = part.split(':').map(Number);
  return (hour || 0) * 60 + (minute || 0);
};

const appointmentEndMinutes = (apt: AppointmentWithClient) =>
  parseTimeMinutes(apt.appointmentTime) + sessionDuration(apt.durationMinutes);

const formatHourLabel = (hour: number) => `${String(hour).padStart(2, '0')}:00`;

const resolveGridRange = (apts: AppointmentWithClient[]) => {
  let startMinutes = GRID_START_HOUR * 60;
  let endMinutes = GRID_END_HOUR * 60;
  for (const apt of apts) {
    const start = parseTimeMinutes(apt.appointmentTime);
    const end = appointmentEndMinutes(apt);
    startMinutes = Math.min(startMinutes, Math.floor(start / 60) * 60);
    endMinutes = Math.max(endMinutes, Math.ceil(end / 60) * 60);
  }
  return { startMinutes, endMinutes };
};

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

const snapTimeFromOffset = (offsetY: number, startMinutes: number) => {
  const raw = startMinutes + (offsetY / HOUR_PX) * 60;
  const snapped = Math.round(raw / 30) * 30;
  const hour = Math.min(23, Math.max(0, Math.floor(snapped / 60)));
  const minute = snapped % 60 === 30 ? '30' : '00';
  return `${String(hour).padStart(2, '0')}:${minute}`;
};

export const Calendar = () => {
  const [currentDate, setCurrentDate] = useState(() => parseStoredDate(readCalendarState()?.currentDate));
  const [viewMode, setViewMode] = useState<ViewMode>(() => readCalendarState()?.viewMode ?? 'month');
  const [appointments, setAppointments] = useState<AppointmentWithClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addModalDate, setAddModalDate] = useState<string | undefined>();
  const [addModalTime, setAddModalTime] = useState<string | undefined>();
  const [now, setNow] = useState(() => new Date());
  const timeGridRef = useRef<HTMLDivElement>(null);
  const [updateModalAppointment, setUpdateModalAppointment] =
    useState<AppointmentWithClient | null>(null);
  const [peekAppointment, setPeekAppointment] = useState<AppointmentWithClient | null>(null);
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [calendarScope, setCalendarScope] = useState<CalendarScope>(
    () => readCalendarState()?.calendarScope ?? 'mine'
  );
  const [roomFilter, setRoomFilter] = useState<number | 0>(() => readCalendarState()?.roomFilter ?? 0);

  const loadAppointments = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getAllAppointments(calendarScope);
      setAppointments(data);
    } catch (error) {
      console.error('Error loading appointments:', error);
    } finally {
      setLoading(false);
    }
    try {
      setClinic(await getMyClinic());
    } catch (error) {
      console.error('Error loading clinic:', error);
    }
  }, [calendarScope]);

  useEffect(() => {
    loadAppointments();
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
    const today = new Date();
    const days =
      viewMode === 'day'
        ? [currentDate]
        : eachDayOfInterval({
            start: startOfWeek(currentDate, { weekStartsOn: 1 }),
            end: endOfWeek(currentDate, { weekStartsOn: 1 }),
          });
    if (!days.some((day) => isSameDay(day, today))) return;
    const visibleApts = days.flatMap((day) => {
      const dayStr = format(day, 'yyyy-MM-dd');
      return appointments.filter((apt) => {
        const aptDate = apt.appointmentDate.includes('T')
          ? apt.appointmentDate.split('T')[0]
          : apt.appointmentDate;
        return aptDate === dayStr && (!roomFilter || apt.roomId === roomFilter);
      });
    });
    const { startMinutes } = resolveGridRange(visibleApts);
    const nowMin = today.getHours() * 60 + today.getMinutes();
    timeGridRef.current.scrollTop = Math.max(0, ((nowMin - startMinutes) / 60) * HOUR_PX - 160);
  }, [loading, viewMode, currentDate, appointments, roomFilter]);

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

  const getAppointmentsForDate = (date: Date) => {
    const dayStr = format(date, 'yyyy-MM-dd');
    const apts = appointments.filter((apt) => {
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

  const formatTime = (time: string | null) => (time || '09:00').slice(0, 5);

  const openAddModal = (date?: Date, time?: string) => {
    setAddModalDate(date ? format(date, 'yyyy-MM-dd') : undefined);
    setAddModalTime(time);
    setAddModalOpen(true);
  };

  const openUpdateModal = (apt: AppointmentWithClient, e: React.MouseEvent) => {
    e.stopPropagation();
    if (apt.mine === false) {
      setPeekAppointment(apt);
      return;
    }
    setUpdateModalAppointment(apt);
  };

  const cardStyle = (apt: AppointmentWithClient) => {
    const color = therapistColor(apt.therapistUserId) || apt.roomColor;
    return color ? { background: color } : undefined;
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
    const allApts = days.flatMap((day) => getAppointmentsForDate(day));
    const { startMinutes, endMinutes } = resolveGridRange(allApts);
    const hours: number[] = [];
    for (let hour = startMinutes / 60; hour < endMinutes / 60; hour += 1) {
      hours.push(hour);
    }
    const gridHeight = ((endMinutes - startMinutes) / 60) * HOUR_PX;
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const nowTop = ((nowMinutes - startMinutes) / 60) * HOUR_PX;
    const showNow = nowMinutes >= startMinutes && nowMinutes <= endMinutes;

    return (
      <div className="time-grid">
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
              const isToday = isSameDay(day, now);
              return (
                <div
                  key={day.toISOString()}
                  className={`time-day-col ${isToday ? 'is-today' : ''}`}
                  style={{ height: gridHeight }}
                  onClick={(event) => {
                    const offsetY = event.clientY - event.currentTarget.getBoundingClientRect().top;
                    openAddModal(day, snapTimeFromOffset(offsetY, startMinutes));
                  }}
                  role="presentation"
                >
                  {hours.map((hour) => (
                    <div key={hour} className="time-hour-line" style={{ height: HOUR_PX }} />
                  ))}
                  {laidOut.map((item) => {
                    const top = ((item.start - startMinutes) / 60) * HOUR_PX;
                    const height = Math.max(((item.end - item.start) / 60) * HOUR_PX - 2, 28);
                    const width = `calc((100% - 6px) / ${item.cols})`;
                    const left = `calc(3px + ${item.col} * (100% - 6px) / ${item.cols})`;
                    return (
                      <div
                        key={item.apt.id}
                        className={`time-event status-${appointmentStatus(item.apt.status)} ${item.apt.mine === false ? 'not-mine' : ''}`}
                        style={{
                          top,
                          height,
                          width,
                          left,
                          ...cardStyle(item.apt),
                        }}
                        onClick={(event) => openUpdateModal(item.apt, event)}
                      >
                        <span className="time-event-time">{formatTime(item.apt.appointmentTime)}</span>
                        <span className="time-event-title">{clinicSafeLabel(item.apt)}</span>
                        {item.apt.roomName ? <span className="time-event-meta">{item.apt.roomName}</span> : null}
                        {calendarScope === 'clinic' && item.apt.therapistName ? (
                          <span className="time-event-meta">{item.apt.therapistName}</span>
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
                      onClick={(e) => openUpdateModal(apt, e)}
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
    <div className="calendar-container">
      <div className="calendar-header">
        <div className="calendar-toolbar">
          <button type="button" className="calendar-nav-btn" onClick={goPrev}>
            ‹
          </button>
          <button type="button" className="calendar-today-btn" onClick={goToday}>
            Bugün
          </button>
          <button type="button" className="calendar-nav-btn" onClick={goNext}>
            ›
          </button>
          <h2 className="calendar-title">{getTitle()}</h2>
        </div>
        <button
          type="button"
          className="calendar-add-btn"
          onClick={() => openAddModal(currentDate)}
        >
          + Randevu Ekle
        </button>
        {clinic ? (
          <div className="calendar-view-switcher">
            <button
              type="button"
              className={`view-btn ${calendarScope === 'mine' ? 'active' : ''}`}
              onClick={() => setCalendarScope('mine')}
            >
              Ben
            </button>
            <button
              type="button"
              className={`view-btn ${calendarScope === 'clinic' ? 'active' : ''}`}
              onClick={() => setCalendarScope('clinic')}
            >
              Tüm klinik
            </button>
            <select
              className="calendar-room-filter"
              value={roomFilter}
              onChange={(e) => setRoomFilter(Number(e.target.value))}
            >
              <option value={0}>Tüm odalar</option>
              {clinic.rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="calendar-view-switcher">
          <button
            type="button"
            className={`view-btn ${viewMode === 'day' ? 'active' : ''}`}
            onClick={() => setViewMode('day')}
          >
            Günlük
          </button>
          <button
            type="button"
            className={`view-btn ${viewMode === 'week' ? 'active' : ''}`}
            onClick={() => setViewMode('week')}
          >
            Haftalık
          </button>
          <button
            type="button"
            className={`view-btn ${viewMode === 'month' ? 'active' : ''}`}
            onClick={() => setViewMode('month')}
          >
            Aylık
          </button>
        </div>
      </div>

      {loading ? (
        <div className="calendar-loading">Yükleniyor...</div>
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
        }}
        initialTime={addModalTime}
        onSuccess={(createdAppointment) => {
          setAddModalTime(undefined);
          loadAppointments();
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
        onSuccess={loadAppointments}
        appointment={updateModalAppointment}
      />
      {peekAppointment ? (
        <div className="modal-overlay" onClick={() => setPeekAppointment(null)}>
          <div className="modal-content calendar-peek" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Klinik seansı</h2>
              <button type="button" className="close-button" onClick={() => setPeekAppointment(null)}>
                ×
              </button>
            </div>
            <p>
              {formatTime(peekAppointment.appointmentTime)} · {clinicSafeLabel(peekAppointment)}
            </p>
            {peekAppointment.roomName ? <p>Oda: {peekAppointment.roomName}</p> : null}
            {peekAppointment.therapistName ? <p>Terapist: {peekAppointment.therapistName}</p> : null}
            <p className="calendar-peek-hint">Bu seans bir meslektaşa ait. Notlar ve düzenleme kapalı.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
};
