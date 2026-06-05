import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAppSelector } from '../../store/hooks';
import type { Appointment } from '../../types/appointment';
import PrescriptionModal from './PrescriptionModal';
import CompletionModal from './CompletionModal';

const AppointmentList: React.FC = () => {
  const { token, user } = useAppSelector((state) => state.auth);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);

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

  // Listen to live SSE notification events
  useEffect(() => {
    const handleRefresh = () => {
      console.log('SSE notification received, refreshing queue...');
      fetchAppointments();
    };
    window.addEventListener('refreshAppointments', handleRefresh);
    return () => {
      window.removeEventListener('refreshAppointments', handleRefresh);
    };
  }, [token]);

  // Fetch doctors list for admin doctor reassignment dropdown
  useEffect(() => {
    const fetchDoctors = async () => {
      if (token && user?.isAdmin && user?.userType === 'doctor') {
        try {
          const API_URL = import.meta.env.VITE_API_URL;
          const response = await axios.get(`${API_URL}/users?userType=doctor&isActive=true`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          setDoctors(response.data.users || []);
        } catch (error) {
          console.error('Failed to fetch active doctors:', error);
        }
      }
    };
    fetchDoctors();
  }, [token, user]);

  const handleAcceptShift = async (id: string) => {
    try {
      const API_URL = import.meta.env.VITE_API_URL;
      const response = await axios.put(`${API_URL}/appointments/${id}/accept-shift`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      handleAppointmentUpdate(response.data.appointment);
    } catch (error) {
      console.error('Failed to accept shift:', error);
      alert('Failed to accept shift change.');
    }
  };

  const handleDelayAppointment = async (id: string, delayMinutes: number) => {
    try {
      const API_URL = import.meta.env.VITE_API_URL;
      await axios.put(`${API_URL}/appointments/${id}/delay`, { delayMinutes }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchAppointments();
    } catch (error) {
      console.error('Failed to apply delay:', error);
      alert('Failed to apply delay override.');
    }
  };

  const handleReassignDoctor = async (id: string, doctorId: string) => {
    try {
      const API_URL = import.meta.env.VITE_API_URL;
      const response = await axios.put(`${API_URL}/appointments/${id}/reassign`, { doctorId }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      handleAppointmentUpdate(response.data.appointment);
    } catch (error) {
      console.error('Failed to reassign doctor:', error);
      alert('Failed to reassign doctor.');
    }
  };

  const handleStatusUpdate = async (id: string, status: 'arrived' | 'start') => {
    try {
      const API_URL = import.meta.env.VITE_API_URL;
      const endpoint = status === 'arrived' ? 'arrived' : 'start';
      const response = await axios.put(`${API_URL}/appointments/${id}/${endpoint}`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      handleAppointmentUpdate(response.data.appointment);
    } catch (error) {
      console.error(`Failed to update status to ${status}:`, error);
      alert(`Failed to update status. Please try again.`);
    }
  };

  const handleAppointmentUpdate = (updatedAppointment: Appointment) => {
    setAppointments((prev) =>
      prev.map((app) => (app.id === updatedAppointment.id ? updatedAppointment : app))
    );
    setSelectedAppointment(updatedAppointment);
  };

  if (loading) {
    return <div className="text-center py-8">Loading appointments...</div>;
  }

  const upcomingAppointments = appointments.filter((a) => 
    a.status === 'scheduled' || a.status === 'arrived' || a.status === 'in-consultation'
  );
  const pastAppointments = appointments.filter((a) => a.status === 'completed' || a.status === 'cancelled');

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Upcoming & Active */}
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-100 dark:border-gray-700 transition-all duration-300">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Today's Queue</h3>
        {upcomingAppointments.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-4">No appointments in queue.</p>
        ) : (
          <div className="space-y-4">
            {upcomingAppointments.map((app) => (
              <div key={app.id} className="flex flex-col p-4 bg-blue-50/50 dark:bg-blue-950/20 rounded-xl border border-blue-100 dark:border-blue-900/30 gap-4 transition-all duration-300">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-primary-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md">
                          #{app.queueNumber}
                      </div>
                      <div>
                          <p className="font-semibold text-gray-900 dark:text-white">
                              {user?.userType === 'patient' ? `Dr. ${app.doctor?.lastName}` : `${app.patient?.firstName} ${app.patient?.lastName}`}
                          </p>
                          <p className="text-sm text-blue-600 dark:text-blue-400 font-semibold mt-0.5">
                              Est: {new Date(app.estimatedStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                      </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                      <span className={`px-3 py-1.5 text-xs font-semibold rounded-full capitalize ${
                          app.status === 'scheduled' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200' : 
                          app.status === 'arrived' ? 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200' :
                          'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200'
                      }`}>
                          {app.status}
                      </span>

                      {/* Doctor Reassignment (Admin Doctor Only) */}
                      {user?.isAdmin && user?.userType === 'doctor' && (app.status === 'scheduled' || app.status === 'arrived') && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 dark:text-gray-400">Assign:</span>
                          <select
                            value={app.doctorId}
                            onChange={(e) => handleReassignDoctor(app.id, e.target.value)}
                            className="px-2 py-1 bg-white dark:bg-gray-750 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                          >
                            {doctors.map((doc) => (
                              <option key={doc.id} value={doc.id}>
                                Dr. {doc.firstName} {doc.lastName}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Manual Delay Adjustment (Staff Only) */}
                      {(user?.userType === 'receptionist' || user?.userType === 'doctor') && (app.status === 'scheduled' || app.status === 'arrived') && (
                        <div className="flex items-center gap-1.5 bg-white/40 dark:bg-gray-900/40 p-1 rounded-lg border border-gray-200 dark:border-gray-700">
                          <span className="text-[10px] uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400 px-1">Delay:</span>
                          <button
                            onClick={() => handleDelayAppointment(app.id, 15)}
                            className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-bold rounded transition-colors shadow-sm"
                            title="Delay 15 mins"
                          >
                            +15m
                          </button>
                          <button
                            onClick={() => handleDelayAppointment(app.id, 30)}
                            className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold rounded transition-colors shadow-sm"
                            title="Delay 30 mins"
                          >
                            +30m
                          </button>
                        </div>
                      )}

                      {/* Staff Actions */}
                      {user?.userType === 'receptionist' && (
                          <div className="flex gap-2">
                              {app.status === 'scheduled' && (
                                  <button 
                                      onClick={() => handleStatusUpdate(app.id, 'arrived')}
                                      className="px-4 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
                                  >
                                      Mark Arrived
                                  </button>
                              )}
                              {app.status === 'arrived' && (
                                  <button 
                                      onClick={() => handleStatusUpdate(app.id, 'start')}
                                      className="px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
                                  >
                                      Start Consult
                                  </button>
                              )}
                          </div>
                      )}

                      {/* Doctor Actions */}
                      {user?.userType === 'doctor' && app.status === 'in-consultation' && (
                          <button 
                              onClick={() => {
                                  setSelectedAppointment(app);
                                  setIsCompleting(true);
                              }}
                              className="px-4 py-1.5 bg-gradient-to-r from-primary-600 to-secondary-600 hover:from-primary-700 hover:to-secondary-700 text-white text-xs font-bold rounded-lg transition-colors shadow-md"
                          >
                              Write Prescription
                          </button>
                      )}
                  </div>
                </div>

                {/* Patient Shift Acceptance Warning Banner */}
                {user?.userType === 'patient' && app.shiftAccepted === false && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl text-amber-800 dark:text-amber-200 gap-3 w-full animate-fade-in">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span className="text-xs font-semibold">
                        Clinic delay detected. New estimated time is {new Date(app.estimatedStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.
                      </span>
                    </div>
                    <button
                      onClick={() => handleAcceptShift(app.id)}
                      className="px-4 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-xs font-bold rounded-lg shadow-md transition-all duration-200 transform hover:-translate-y-0.5"
                    >
                      Accept Shift
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Past/History */}
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-100 dark:border-gray-700 transition-all duration-300">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Appointment History</h3>
        {pastAppointments.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-4">No past appointments.</p>
        ) : (
          <div className="space-y-4">
             {pastAppointments.map((app) => (
              <div 
                key={app.id} 
                className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-gray-50/50 dark:bg-gray-900/30 rounded-xl border border-gray-100 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-900/50 transition cursor-pointer gap-4"
                onClick={() => {
                    setSelectedAppointment(app);
                    setIsCompleting(false);
                }}
              >
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 font-bold">
                        #{app.queueNumber}
                    </div>
                    <div>
                        <p className="font-semibold text-gray-900 dark:text-white">
                            {user?.userType === 'patient' ? `Dr. ${app.doctor?.lastName}` : `${app.patient?.firstName} ${app.patient?.lastName}`}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{new Date(app.dateTime).toLocaleDateString()}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className={`px-3 py-1.5 text-xs font-semibold rounded-full capitalize ${
                        app.status === 'completed' ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200' : 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200'
                    }`}>
                        {app.status}
                    </span>
                    {app.status === 'completed' && (
                        <button 
                            className="text-primary-600 dark:text-primary-400 text-sm font-semibold hover:underline"
                            onClick={(e) => {
                                e.stopPropagation();
                                setSelectedAppointment(app);
                                setIsCompleting(false);
                            }}
                        >
                            View Records
                        </button>
                    )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedAppointment && isCompleting && (
        <CompletionModal
            appointment={selectedAppointment}
            onClose={() => {
                setSelectedAppointment(null);
                setIsCompleting(false);
            }}
            onUpdate={handleAppointmentUpdate}
        />
      )}

      {selectedAppointment && !isCompleting && (
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
