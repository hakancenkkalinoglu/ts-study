import { useState, useEffect, useCallback } from 'react';
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
import { getAllAppointments } from '../services/api';
import type { AppointmentWithClient } from '../types';
import { AddAppointmentModal } from '../components/AddAppointmentModal';
import { UpdateAppointmentModal } from '../components/UpdateAppointmentModal';
import './Calendar.css';

type ViewMode = 'day' | 'week' | 'month';

export const Calendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [appointments, setAppointments] = useState<AppointmentWithClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addModalDate, setAddModalDate] = useState<string | undefined>();
  const [updateModalAppointment, setUpdateModalAppointment] =
    useState<AppointmentWithClient | null>(null);

  const loadAppointments = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getAllAppointments();
      setAppointments(data);
    } catch (error) {
      console.error('Error loading appointments:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

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
    return [...apts].sort((a, b) => {
      const timeA = a.appointmentTime || '00:00';
      const timeB = b.appointmentTime || '00:00';
      return timeA.localeCompare(timeB);
    });
  };

  const formatTime = (time: string | null) => (time || '09:00').slice(0, 5);

  const openAddModal = (date?: Date) => {
    setAddModalDate(date ? format(date, 'yyyy-MM-dd') : undefined);
    setAddModalOpen(true);
  };

  const openUpdateModal = (apt: AppointmentWithClient, e: React.MouseEvent) => {
    e.stopPropagation();
    setUpdateModalAppointment(apt);
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

  const renderDayView = () => {
    const apts = getAppointmentsForDate(currentDate);
    return (
      <div className="calendar-day-view">
        <div className="day-date-row">
          <span className="day-date">{format(currentDate, 'EEEE, d MMMM yyyy', { locale: tr })}</span>
          <button
            type="button"
            className="day-add-btn"
            onClick={() => openAddModal(currentDate)}
          >
            + Randevu Ekle
          </button>
        </div>
        <div className="day-appointments">
          {apts.length === 0 ? (
            <p className="no-appointments">Bu gün için randevu yok.</p>
          ) : (
            apts.map((apt) => (
              <div
                key={apt.id}
                className="calendar-apt-card"
                onClick={(e) => openUpdateModal(apt, e)}
              >
                <div className="apt-time">{formatTime(apt.appointmentTime)}</div>
                <div className="apt-title">{apt.title || 'Randevu'}</div>
                <div className="apt-client">{apt.clientName || 'Danışan'}</div>
                {apt.googleMeetLink && (
                  <a
                    href={apt.googleMeetLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="apt-meet-link"
                    onClick={(e) => e.stopPropagation()}
                    title="Meet linki"
                  >
                    Meet
                  </a>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = endOfWeek(currentDate, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start, end });

    return (
      <div className="calendar-week-view">
        {days.map((day) => {
          const apts = getAppointmentsForDate(day);
          return (
            <div
              key={day.toISOString()}
              className="week-day-cell"
              onClick={() => openAddModal(day)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && openAddModal(day)}
            >
              <div className="week-day-header">
                <span className="week-day-name">{format(day, 'EEE', { locale: tr })}</span>
                <span className="week-day-num">{format(day, 'd')}</span>
              </div>
              <div className="week-day-apts">
                {apts.map((apt) => (
                  <div
                    key={apt.id}
                    className="calendar-apt-card small"
                    onClick={(e) => openUpdateModal(apt, e)}
                  >
                    <span className="apt-time-sm">{formatTime(apt.appointmentTime)}</span>
                    <span className="apt-client">{apt.clientName || 'Danışan'}</span>
                    {apt.title && <span className="apt-title-sm">{apt.title}</span>}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
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
        <div className="month-grid">
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
                  {apts.slice(0, 3).map((apt) => (
                    <div
                      key={apt.id}
                      className="calendar-apt-card tiny"
                      onClick={(e) => openUpdateModal(apt, e)}
                      title={`${formatTime(apt.appointmentTime)} - ${apt.clientName || 'Danışan'}${apt.title ? ` - ${apt.title}` : ''}`}
                    >
                      <span className="apt-time-tiny">{formatTime(apt.appointmentTime)}</span>
                      {apt.clientName || 'Randevu'}
                    </div>
                  ))}
                  {apts.length > 3 && (
                    <span className="more-apts">+{apts.length - 3}</span>
                  )}
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
        onClose={() => setAddModalOpen(false)}
        onSuccess={(createdAppointment) => {
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
    </div>
  );
};
