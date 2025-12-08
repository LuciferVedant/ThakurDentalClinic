import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAppSelector } from '../../store/hooks';
import type { Appointment } from '../../types/appointment';
import PrescriptionModal from './PrescriptionModal';

const AppointmentList: React.FC = () => {
  const { token } = useAppSelector((state) => state.auth);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);

  const fetchAppointments = async () => {
    try {
      const API_URL = import.meta.env.VITE_API_URL;
      const response = await axios.get(`${API_URL}/appointments`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAppointments(response.data.appointments || []);
    } catch (error) {
      console.error('Failed to fetch appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchAppointments();
    }
  }, [token]);

  const handleAppointmentUpdate = (updatedAppointment: Appointment) => {
    setAppointments((prev) =>
      prev.map((app) => (app.id === updatedAppointment.id ? updatedAppointment : app))
    );
    setSelectedAppointment(updatedAppointment);
  };

  if (loading) {
    return <div className="text-center py-8">Loading appointments...</div>;
  }

  const upcomingAppointments = appointments.filter((a) => a.status === 'scheduled');
  const pastAppointments = appointments.filter((a) => a.status === 'completed' || a.status === 'cancelled');

  return (
    <div className="space-y-8">
      {/* Upcoming */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-100">
        <h3 className="text-xl font-bold text-gray-900 mb-6">Upcoming Appointments</h3>
        {upcomingAppointments.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No upcoming appointments.</p>
        ) : (
          <div className="space-y-4">
            {upcomingAppointments.map((app) => (
              <div key={app.id} className="flex items-center justify-between p-4 bg-blue-50 rounded-xl border border-blue-100">
                <div>
                  <p className="font-semibold text-gray-900">Dr. {app.doctor?.lastName || 'Doctor'}</p>
                   <p className="text-sm text-blue-600">{new Date(app.dateTime).toLocaleString()}</p>
                </div>
                <div className="px-3 py-1 bg-blue-200 text-blue-800 text-xs font-semibold rounded-full">
                  Upcoming
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Past/History */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-100">
        <h3 className="text-xl font-bold text-gray-900 mb-6">Appointment History</h3>
        {pastAppointments.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No past appointments.</p>
        ) : (
          <div className="space-y-4">
             {pastAppointments.map((app) => (
              <div 
                key={app.id} 
                className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100 hover:bg-gray-100 transition cursor-pointer"
                onClick={() => setSelectedAppointment(app)}
              >
                <div>
                  <p className="font-semibold text-gray-900">Dr. {app.doctor?.lastName || 'Doctor'}</p>
                   <p className="text-sm text-gray-500">{new Date(app.dateTime).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                        app.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                        {app.status}
                    </span>
                    {app.status === 'completed' && (
                        <button 
                            className="text-primary-600 text-sm font-medium hover:underline"
                            onClick={(e) => {
                                e.stopPropagation();
                                setSelectedAppointment(app);
                            }}
                        >
                            View Prescription
                        </button>
                    )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedAppointment && (
        <PrescriptionModal
          appointment={selectedAppointment}
          onClose={() => setSelectedAppointment(null)}
          onUpdate={handleAppointmentUpdate}
        />
      )}
    </div>
  );
};

export default AppointmentList;
