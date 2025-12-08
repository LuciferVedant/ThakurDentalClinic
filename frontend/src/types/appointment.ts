import type { User } from '../store/slices/authSlice';

export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled';

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  dateTime: string;
  status: AppointmentStatus;
  prescriptionUrl?: string; // Legacy
  prescriptionUrls?: string; // JSON string array
  notes?: string;
  createdAt: string;
  updatedAt: string;
  patient?: User;
  doctor?: User;
}
