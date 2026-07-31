const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export const APPOINTMENT_STATUSES = ['scheduled', 'completed', 'cancelled'];

export const ALLOWED_TRANSITIONS = {
  scheduled: ['completed', 'cancelled'],
  completed: ['cancelled'],
  cancelled: ['scheduled'],
};

export function isValidEmail(value) {
  return EMAIL_REGEX.test(value || '');
}

export function isValidDate(value) {
  if (!DATE_REGEX.test(value || '')) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function isValidTime(value) {
  return TIME_REGEX.test(value || '');
}

export function isInPast(date, time) {
  if (!date) return false;
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = (time || '00:00').split(':').map(Number);
  const when = new Date(y, m - 1, d, hh || 0, mm || 0);
  return when.getTime() < Date.now();
}

export function isValidStatusTransition(from, to) {
  if (!APPOINTMENT_STATUSES.includes(to)) return false;
  if (from === to) return true;
  return (ALLOWED_TRANSITIONS[from] || []).includes(to);
}
