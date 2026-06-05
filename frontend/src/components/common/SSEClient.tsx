import React, { useEffect, useState } from 'react';
import { useAppSelector } from '../../store/hooks';

interface ToastMessage {
	id: string;
	type: 'QUEUE_SHIFT' | 'DOCTOR_REASSIGNED' | 'PRE_ARRIVAL_REMINDER';
	message: string;
	timestamp: Date;
}

export const SSEClient: React.FC = () => {
	const token = useAppSelector((state) => state.auth.token);
	const [toasts, setToasts] = useState<ToastMessage[]>([]);

	useEffect(() => {
		if (!token) return;

		const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';
		const baseUrl = apiUrl.endsWith('/api') ? apiUrl : `${apiUrl}/api`;
		const streamUrl = `${baseUrl}/auth/stream?token=${encodeURIComponent(token)}`;

		console.log('SSE: Connecting to', streamUrl);
		const eventSource = new EventSource(streamUrl);

		eventSource.onmessage = (event) => {
			console.log('SSE message received:', event.data);
			if (event.data === 'connected') return;

			try {
				const payload = JSON.parse(event.data);
				const newToast: ToastMessage = {
					id: Math.random().toString(36).substring(2, 9),
					type: payload.type,
					message: payload.message,
					timestamp: new Date(),
				};

				setToasts((prev) => [newToast, ...prev]);

				// Automatically remove after 8 seconds
				setTimeout(() => {
					setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
				}, 8000);

				// Dispatch a custom event to notify other components to refresh appointment data
				window.dispatchEvent(new CustomEvent('refreshAppointments'));
			} catch (err) {
				console.error('Failed to parse SSE payload:', err);
			}
		};

		eventSource.onerror = (err) => {
			console.error('SSE Error:', err);
		};

		return () => {
			eventSource.close();
		};
	}, [token]);

	const removeToast = (id: string) => {
		setToasts((prev) => prev.filter((t) => t.id !== id));
	};

	if (toasts.length === 0) return null;

	return (
		<div className="fixed top-20 right-5 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
			<style>{`
				@keyframes slideIn {
					from { transform: translateX(120%); opacity: 0; }
					to { transform: translateX(0); opacity: 1; }
				}
				.animate-slide-in {
					animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
				}
			`}</style>
			{toasts.map((toast) => {
				let bgColor = 'bg-blue-600';
				let icon = (
					<svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
				);
				let title = 'Notification';

				if (toast.type === 'QUEUE_SHIFT') {
					bgColor = 'bg-amber-500 dark:bg-amber-600';
					title = 'Queue Delay Alert';
					icon = (
						<svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
					);
				} else if (toast.type === 'PRE_ARRIVAL_REMINDER') {
					bgColor = 'bg-emerald-500 dark:bg-emerald-600';
					title = 'Pre-Arrival Reminder';
					icon = (
						<svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
						</svg>
					);
				} else if (toast.type === 'DOCTOR_REASSIGNED') {
					bgColor = 'bg-indigo-600 dark:bg-indigo-700';
					title = 'Doctor Reassigned';
					icon = (
						<svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
						</svg>
					);
				}

				return (
					<div
						key={toast.id}
						className={`pointer-events-auto flex items-start p-4 rounded-xl shadow-2xl border border-white/10 text-white backdrop-blur-md transition-all duration-300 transform translate-x-0 ${bgColor} animate-slide-in`}
					>
						<div className="flex-shrink-0 mr-3 mt-0.5">{icon}</div>
						<div className="flex-1">
							<h4 className="font-semibold text-sm leading-none">{title}</h4>
							<p className="mt-1 text-xs text-white/90 leading-normal">{toast.message}</p>
						</div>
						<button
							onClick={() => removeToast(toast.id)}
							className="flex-shrink-0 ml-3 text-white/80 hover:text-white transition-colors"
						>
							<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>
				);
			})}
		</div>
	);
};
export default SSEClient;
