import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAppSelector } from '../store/hooks';
import Layout from '../components/Layout';
import ProfileCard from '../components/profile/ProfileCard';
import AppointmentList from '../components/appointments/AppointmentList';
import { useTranslation } from 'react-i18next';

const PatientDashboard: React.FC = () => {
  const { user, token } = useAppSelector((state) => state.auth);
  const { t } = useTranslation();
  const [isBooking, setIsBooking] = useState(false);
  const [slot, setSlot] = useState('morning');
  const [notes, setNotes] = useState('');
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [appointments, setAppointments] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const API_URL = import.meta.env.VITE_API_URL;
        const [docsRes, appsRes] = await Promise.all([
          axios.get(`${API_URL}/users?userType=doctor&isActive=true`, { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`${API_URL}/appointments`, { headers: { Authorization: `Bearer ${token}` } })
        ]);
        setDoctors(docsRes.data.users || []);
        setAppointments(appsRes.data.appointments || []);
      } catch (err) {
        console.error('Failed to fetch dashboard data');
      }
    };
    fetchData();
  }, [token]);

  const handleBook = async () => {
    if (doctors.length === 0) {
      alert('No doctors available at the moment.');
      return;
    }

    setLoading(true);
    try {
      const API_URL = import.meta.env.VITE_API_URL;
      // We pick the first doctor for now as per "no need to choose doctor"
      const doctorId = doctors[0].id;

      // Determine time based on slot
      const dateTime = new Date();
      if (slot === 'morning') dateTime.setHours(10, 0, 0);
      else if (slot === 'afternoon') dateTime.setHours(14, 0, 0);
      else dateTime.setHours(17, 0, 0);

      await axios.post(`${API_URL}/appointments`, {
        doctorId,
        dateTime: dateTime.toISOString(),
        notes
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });

      alert('Appointment booked successfully!');
      setIsBooking(false);
      window.location.reload(); // Quick refresh to update list
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to book appointment');
    } finally {
      setLoading(false);
    }
  };

  const upcomingCount = appointments.filter(a => ['scheduled', 'arrived', 'in-consultation'].includes(a.status)).length;
  const totalVisits = appointments.filter(a => a.status === 'completed').length;
  const nextApp = appointments.find(a => ['scheduled', 'arrived', 'in-consultation'].includes(a.status));

  return (
    <Layout>
      <div className="space-y-6">
        {/* Welcome Section */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-lg p-8 border border-gray-100 transition-colors">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent mb-2">
            Welcome back, {user?.firstName}!
          </h2>
          <p className="text-gray-600 dark:text-gray-300">{t('dashboard.manageAppointments')}</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg p-6 text-white transform transition-all duration-200 hover:scale-105">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm font-medium">{t('dashboard.upcomingAppointments')}</p>
                <p className="text-3xl font-bold mt-2">{upcomingCount}</p>
              </div>
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl shadow-lg p-6 text-white transform transition-all duration-200 hover:scale-105">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm font-medium">{t('dashboard.totalVisits')}</p>
                <p className="text-3xl font-bold mt-2">{totalVisits}</p>
              </div>
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl shadow-lg p-6 text-white transform transition-all duration-200 hover:scale-105">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm font-medium">{t('dashboard.nextCheckup')}</p>
                <p className="text-lg font-semibold mt-2">
                  {nextApp ? new Date(nextApp.dateTime).toLocaleDateString() : t('dashboard.notScheduled')}
                </p>
              </div>
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Profile Section */}
        <section id="profile">
          <ProfileCard />
        </section>

        {/* Appointments Section */}
        <section id="appointments">
          <AppointmentList />
        </section>

        {/* Book Appointment */}
        {!isBooking ? (
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-lg p-8 border border-gray-100  transition-colors">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">{t('dashboard.bookAppointment')}</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">{t('dashboard.scheduleCheckup')}</p>
            <button
              onClick={() => setIsBooking(true)}
              className="px-6 py-3 bg-gradient-to-r from-primary-600 to-secondary-600 hover:from-primary-700 hover:to-secondary-700 text-white font-medium rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              {t('dashboard.scheduleAppointment')}
            </button>
          </div>
        ) : (
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-lg p-8 border border-primary-100 dark:border-primary-900 transition-colors animate-fade-in">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Confirm Booking</h3>
            <div className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select Time Slot</label>
                <select
                  value={slot}
                  onChange={(e) => setSlot(e.target.value)}
                  className="w-full p-3 rounded-xl border border-gray-200 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="morning">Morning (10:00 AM)</option>
                  <option value="afternoon">Afternoon (2:00 PM)</option>
                  <option value="evening">Evening (5:00 PM)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Notes for Doctor</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Toothache, Regular Checkup..."
                  className="w-full p-3 rounded-xl border border-gray-200 dark:bg-gray-700 dark:border-gray-600 dark:text-white min-h-[100px]"
                />
              </div>
              <div className="flex gap-4 pt-4">
                <button
                  onClick={handleBook}
                  disabled={loading}
                  className="flex-1 py-3 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Booking...' : 'Confirm Token'}
                </button>
                <button
                  onClick={() => setIsBooking(false)}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default PatientDashboard;
