import { google } from 'googleapis';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TOKENS_PATH = path.join(__dirname, '../../data/google-tokens.json');
const SCOPES = ['https://www.googleapis.com/auth/calendar'];
const TIMEZONE = 'Europe/Istanbul';
function getOAuth2Client() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
        throw new Error('GOOGLE_CLIENT_ID ve GOOGLE_CLIENT_SECRET .env dosyasında tanımlı olmalı.');
    }
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback';
    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}
export function getAuthUrl() {
    const oauth2 = getOAuth2Client();
    return oauth2.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent',
    });
}
function loadTokens() {
    try {
        const data = fs.readFileSync(TOKENS_PATH, 'utf-8');
        return JSON.parse(data);
    }
    catch {
        return null;
    }
}
function saveTokens(tokens) {
    const dir = path.dirname(TOKENS_PATH);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2), 'utf-8');
}
export function isConnected() {
    return loadTokens() != null;
}
export async function getTokensFromCode(code) {
    const oauth2 = getOAuth2Client();
    const { tokens } = await oauth2.getToken(code);
    const toSave = {};
    if (tokens.access_token)
        toSave.access_token = tokens.access_token;
    if (tokens.refresh_token)
        toSave.refresh_token = tokens.refresh_token;
    if (tokens.expiry_date != null)
        toSave.expiry_date = tokens.expiry_date;
    saveTokens(toSave);
}
function getAuthClient() {
    const oauth2 = getOAuth2Client();
    const tokens = loadTokens();
    if (!tokens?.access_token) {
        throw new Error('Google Calendar bağlı değil. Önce "Google ile bağlan" ile yetkilendirme yapın.');
    }
    oauth2.setCredentials(tokens);
    return oauth2;
}
/**
 * Randevu tarih/saati + süre (dakika) ile ISO datetime üretir.
 */
function toDateTime(dateStr, timeStr, durationMinutes) {
    const datePart = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.slice(0, 10);
    const timePart = (timeStr || '09:00').slice(0, 5);
    const start = new Date(`${datePart}T${timePart}:00`);
    if (isNaN(start.getTime())) {
        throw new Error('Geçersiz tarih veya saat.');
    }
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
    return {
        start: start.toISOString(),
        end: end.toISOString(),
    };
}
export async function createCalendarEventWithMeet(appointment, durationMinutes = 60) {
    const auth = getAuthClient();
    const calendar = google.calendar({ version: 'v3', auth });
    const clientName = appointment.clientName || 'Danışan';
    const title = appointment.title ? `${clientName} - ${appointment.title}` : `Randevu - ${clientName}`;
    const description = appointment.clientName ? `Danışan: ${appointment.clientName}` : null;
    const { start, end } = toDateTime(appointment.appointmentDate, appointment.appointmentTime ?? '09:00', durationMinutes);
    const requestBody = {
        summary: title,
        description,
        start: { dateTime: start, timeZone: TIMEZONE },
        end: { dateTime: end, timeZone: TIMEZONE },
        conferenceData: {
            createRequest: {
                requestId: `testpsikolog-${appointment.id}-${Date.now()}`,
                conferenceSolutionKey: { type: 'hangoutsMeet' },
            },
        },
    };
    const res = await calendar.events.insert({
        calendarId: 'primary',
        requestBody,
        conferenceDataVersion: 1,
    });
    const data = res.data;
    const meetLink = data.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri;
    const htmlLink = data.htmlLink;
    if (!meetLink) {
        throw new Error('Google Meet linki oluşturulamadı.');
    }
    return {
        meetLink,
        eventId: data.id ?? '',
        htmlLink: htmlLink ?? '',
    };
}
/**
 * Google Calendar'da mevcut etkinliği günceller (tarih, saat, başlık).
 */
export async function updateCalendarEvent(eventId, appointment, durationMinutes = 60) {
    const auth = getAuthClient();
    const calendar = google.calendar({ version: 'v3', auth });
    const clientName = appointment.clientName || 'Danışan';
    const title = appointment.title ? `${clientName} - ${appointment.title}` : `Randevu - ${clientName}`;
    const { start, end } = toDateTime(appointment.appointmentDate, appointment.appointmentTime ?? '09:00', durationMinutes);
    await calendar.events.patch({
        calendarId: 'primary',
        eventId,
        requestBody: {
            summary: title,
            start: { dateTime: start, timeZone: TIMEZONE },
            end: { dateTime: end, timeZone: TIMEZONE },
        },
    });
}
/**
 * Google Calendar'dan etkinliği siler.
 */
export async function deleteCalendarEvent(eventId) {
    const auth = getAuthClient();
    const calendar = google.calendar({ version: 'v3', auth });
    await calendar.events.delete({
        calendarId: 'primary',
        eventId,
    });
}
//# sourceMappingURL=googleCalendarService.js.map