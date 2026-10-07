import { z } from 'zod';

/** Calendar dates are saved as entered locally; never convert them through UTC. */
export const LocalDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Fecha de calendario inválida');

/** Accept supported IANA names (including UTC), never a device-derived numeric offset. */
export const TimeZoneSchema = z.string().min(1).max(100).refine((value) => {
  if (!/^[A-Za-z][A-Za-z0-9._+-]*(?:\/[A-Za-z0-9._+-]+)*$/.test(value)) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}, 'Zona horaria inválida');

