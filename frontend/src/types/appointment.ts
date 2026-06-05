import type { User } from '../store/slices/authSlice';

export type AppointmentStatus = 'scheduled' | 'arrived' | 'in-consultation' | 'completed' | 'cancelled';

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  dateTime: string;
  status: AppointmentStatus;
  queueNumber: number;
  estimatedStartTime: string;
  actualStartTime?: string;
  actualEndTime?: string;
  paymentStatus: 'pending' | 'paid';
  paymentMethod?: 'cash' | 'online';
  prescriptionType?: 'manual' | 'digital';
  prescriptionUrls?: string; // JSON string array
  notes?: string;
  reminderSent?: boolean;
  shiftAccepted?: boolean;
  createdAt: string;
  updatedAt: string;
  patient?: User;
  doctor?: User;
}
