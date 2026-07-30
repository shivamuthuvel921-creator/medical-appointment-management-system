export function createAppointment(input) {
  const appointmentDate = input.appointmentDate?.trim() || '';
  const appointmentTime = input.appointmentTime?.trim() || '';

  return {
    id: crypto.randomUUID(),
    patientName: input.patientName?.trim() || 'Unknown patient',
    medication: input.medication?.trim() || 'Unknown medication',
    doctorName: input.doctorName?.trim() || 'Unassigned doctor',
    appointmentDate,
    appointmentTime,
    notes: input.notes?.trim() || '',
    status: input.status?.trim() || 'scheduled',
  };
}

export function sortAppointments(appointments) {
  return [...appointments].sort((a, b) => {
    const dateCompare = a.appointmentDate.localeCompare(b.appointmentDate);
    if (dateCompare !== 0) return dateCompare;
    return a.appointmentTime.localeCompare(b.appointmentTime);
  });
}
