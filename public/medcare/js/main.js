// ─────────────────────────────────────────────────────────────
// MedCare entry — registers every page and starts the router
// ─────────────────────────────────────────────────────────────
import { start } from './router.js';
import * as store from './store.js';
import { initAuth } from './pages/auth.js';
import { initDashboards } from './pages/dashboard.js';
import { initDoctors } from './pages/doctors.js';
import { initAppointments } from './pages/appointments.js';
import { initHistory } from './pages/history.js';
import { initPrescriptions } from './pages/prescriptions.js';
import { initNotifications } from './pages/notifications.js';
import { initMessages } from './pages/messages.js';
import { initAnalytics } from './pages/analytics.js';
import { initProfile } from './pages/profile.js';
import { initSchedule } from './pages/schedule.js';
import { initQueue } from './pages/queue.js';
import { initPatients } from './pages/patients.js';
import { initConsult } from './pages/consult.js';

initAuth();
initDashboards();
initDoctors();
initAppointments();
initHistory();
initPrescriptions();
initNotifications();
initMessages();
initAnalytics();
initProfile();
initSchedule();
initQueue();
initPatients();
initConsult();

await store.bootstrap();

start();