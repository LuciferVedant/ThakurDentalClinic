import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAppSelector } from '../store/hooks';
import Layout from '../components/Layout';
import AppointmentList from '../components/appointments/AppointmentList';
import ProfileCard from '../components/profile/ProfileCard';
import { useTranslation } from 'react-i18next';

const ReceptionistDashboard: React.FC = () => {
	const { user, token } = useAppSelector((state) => state.auth);
	const { t } = useTranslation();
	const [appointments, setAppointments] = useState<any[]>([]);
	const [activeTab, setActiveTab] = useState<'queue' | 'callList'>('queue');
	const [calledMap, setCalledMap] = useState<Record<string, boolean>>({});

	const fetchAppointments = async () => {
		try {
			const API_URL = import.meta.env.VITE_API_URL;
			const response = await axios.get(`${API_URL}/appointments`, {
				headers: { Authorization: `Bearer ${token}` },
			});
			setAppointments(response.data.appointments || []);
		} catch (error) {
			console.error('Failed to fetch appointments:', error);
		}
	};

	useEffect(() => {
		if (token) {
			fetchAppointments();
		}
	}, [token]);

	useEffect(() => {
		const handleRefresh = () => {
			fetchAppointments();
		};
		window.addEventListener('refreshAppointments', handleRefresh);
		return () => {
			window.removeEventListener('refreshAppointments', handleRefresh);
		};
	}, []);

	const handleDelayAppointment = async (id: string, delayMinutes: number) => {
		try {
			const API_URL = import.meta.env.VITE_API_URL;
			await axios.put(`${API_URL}/appointments/${id}/delay`, { delayMinutes }, {
				headers: { Authorization: `Bearer ${token}` },
			});
			fetchAppointments();
			window.dispatchEvent(new CustomEvent('refreshAppointments'));
		} catch (error) {
			console.error('Failed to delay:', error);
			alert('Failed to delay slot.');
		}
	};

	const handleConfirmCall = (appId: string) => {
		setCalledMap((prev) => ({ ...prev, [appId]: true }));
	};

	const todaysAppointmentsCount = appointments.filter(a => a.status !== 'cancelled').length;
	const checkedInCount = appointments.filter((a) => a.status === 'arrived' || a.status === 'in-consultation' || a.status === 'completed').length;
	const waitingCount = appointments.filter((a) => a.status === 'arrived').length;

	const now = new Date();
	const fortyFiveMinutesLater = new Date(now.getTime() + 45 * 60 * 1000);
	const callList = appointments.filter((app) => {
		if (app.status !== 'scheduled') return false;
		const estTime = new Date(app.estimatedStartTime);
		// Starting within 45 mins from now
		return estTime >= now && estTime <= fortyFiveMinutesLater;
	});

	return (
		<Layout>
			<div className="space-y-6">
				{/* Welcome Section */}
				<div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-lg p-8 border border-gray-100 dark:border-gray-700 transition-colors">
					<h2 className="text-3xl font-bold bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent mb-2">
						Welcome, {user?.firstName}!
					</h2>
					<p className="text-gray-600 dark:text-gray-300">{t('dashboard.manageAppointmentsReceptionist')}</p>
				</div>

				{/* Profile Section */}
				<div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-100 dark:border-gray-700 transition-colors">
					<ProfileCard />
				</div>

				{/* Quick Stats */}
				<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
					<div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg p-6 text-white transform transition-all duration-200 hover:scale-[1.02]">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-blue-100 text-sm font-medium">{t('dashboard.todaysAppointments')}</p>
								<p className="text-3xl font-bold mt-2">{todaysAppointmentsCount}</p>
							</div>
							<div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
								<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
								</svg>
							</div>
						</div>
					</div>

					<div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl shadow-lg p-6 text-white transform transition-all duration-200 hover:scale-[1.02]">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-green-100 text-sm font-medium">{t('dashboard.checkedIn')}</p>
								<p className="text-3xl font-bold mt-2">{checkedInCount}</p>
							</div>
							<div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
								<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
							</div>
						</div>
					</div>

					<div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl shadow-lg p-6 text-white transform transition-all duration-200 hover:scale-[1.02]">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-purple-100 text-sm font-medium">{t('dashboard.waiting')}</p>
								<p className="text-3xl font-bold mt-2">{waitingCount}</p>
							</div>
							<div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
								<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
							</div>
						</div>
					</div>
				</div>

				{/* Dashboard Navigation Tabs */}
				<div className="flex border-b border-gray-200 dark:border-gray-700 bg-white/40 dark:bg-gray-800/40 rounded-xl p-1 gap-1">
					<button
						onClick={() => setActiveTab('queue')}
						className={`flex-1 sm:flex-initial py-2.5 px-6 font-semibold text-sm rounded-lg transition-all duration-250 ${
							activeTab === 'queue'
								? 'bg-gradient-to-r from-primary-500 to-secondary-500 text-white shadow-md'
								: 'text-gray-500 hover:text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'
						}`}
					>
						Appointments Queue
					</button>
					<button
						onClick={() => setActiveTab('callList')}
						className={`flex-1 sm:flex-initial py-2.5 px-6 font-semibold text-sm rounded-lg transition-all duration-250 flex items-center justify-center gap-2 ${
							activeTab === 'callList'
								? 'bg-gradient-to-r from-primary-500 to-secondary-500 text-white shadow-md'
								: 'text-gray-500 hover:text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'
						}`}
					>
						Pre-Arrival Call List
						{callList.length > 0 && (
							<span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-bounce">
								{callList.length}
							</span>
						)}
					</button>
				</div>

				{/* Tab Panels */}
				{activeTab === 'queue' ? (
					<section id="appointments" className="animate-fade-in">
						<AppointmentList />
					</section>
				) : (
					<div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-100 dark:border-gray-700 transition-all duration-300 animate-fade-in">
						<h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Courtesy Call List</h3>
						<p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
							Verify arrival times for patients with appointments starting within the next 45 minutes. You can mark them as called or adjust their slot timing if they request a delay.
						</p>

						{callList.length === 0 ? (
							<div className="text-center py-12">
								<div className="w-16 h-16 bg-gray-100 dark:bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
									<svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
									</svg>
								</div>
								<p className="text-gray-500 dark:text-gray-400 text-sm font-medium">No upcoming pre-arrival calls needed at this time.</p>
							</div>
						) : (
							<div className="space-y-4">
								{callList.map((app) => (
									<div key={app.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-purple-50/50 dark:bg-purple-950/10 rounded-xl border border-purple-100 dark:border-purple-900/30 gap-4 transition-all duration-300">
										<div className="flex items-center gap-4">
											<div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-lg flex items-center justify-center text-white shadow-md">
												<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
												</svg>
											</div>
											<div>
												<p className="font-semibold text-gray-900 dark:text-white">
													{app.patient?.firstName} {app.patient?.lastName}
												</p>
												<p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
													Phone: <a href={`tel:${app.patient?.phone}`} className="text-primary-600 dark:text-primary-400 font-medium hover:underline">{app.patient?.phone || 'Not available'}</a>
												</p>
												<p className="text-xs text-purple-600 dark:text-purple-400 mt-1 font-semibold">
													Scheduled: {new Date(app.estimatedStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
												</p>
											</div>
										</div>

										<div className="flex flex-wrap items-center gap-3">
											{calledMap[app.id] ? (
												<span className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200 text-xs font-semibold rounded-lg border border-green-200 dark:border-green-900/50">
													<svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
													</svg>
													Called
												</span>
											) : (
												<button
													onClick={() => handleConfirmCall(app.id)}
													className="px-4 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-bold rounded-lg transition shadow-md hover:shadow-lg"
												>
													Mark Called
												</button>
											)}

											<div className="flex items-center gap-1.5 bg-white/40 dark:bg-gray-900/40 p-1 rounded-lg border border-gray-200 dark:border-gray-700">
												<span className="text-[10px] uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400 px-1">Delay Slot:</span>
												<button
													onClick={() => handleDelayAppointment(app.id, 15)}
													className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-bold rounded transition-colors shadow-sm"
												>
													+15m
												</button>
												<button
													onClick={() => handleDelayAppointment(app.id, 30)}
													className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold rounded transition-colors shadow-sm"
												>
													+30m
												</button>
											</div>
										</div>
									</div>
								))}
							</div>
						)}
					</div>
				)}
			</div>
		</Layout>
	);
};

export default ReceptionistDashboard;
