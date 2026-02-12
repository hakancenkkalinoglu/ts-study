export type AppointmentForMeet = {
    id: number;
    appointmentDate: string;
    appointmentTime: string | null;
    title: string | null;
    clientName: string | null;
};
export declare function getAuthUrl(): string;
export declare function isConnected(): boolean;
export declare function getTokensFromCode(code: string): Promise<void>;
export declare function createCalendarEventWithMeet(appointment: AppointmentForMeet, durationMinutes?: number): Promise<{
    meetLink: string;
    eventId: string;
    htmlLink: string;
}>;
/**
 * Google Calendar'da mevcut etkinliği günceller (tarih, saat, başlık).
 */
export declare function updateCalendarEvent(eventId: string, appointment: AppointmentForMeet, durationMinutes?: number): Promise<void>;
/**
 * Google Calendar'dan etkinliği siler.
 */
export declare function deleteCalendarEvent(eventId: string): Promise<void>;
//# sourceMappingURL=googleCalendarService.d.ts.map