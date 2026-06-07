import React, { useState } from 'react';
import type { Appointment } from '../../types/appointment';
import axios from 'axios';
import { useAppSelector } from '../../store/hooks';
import FileUpload from '../common/FileUpload';

interface CompletionModalProps {
  appointment: Appointment;
  onClose: () => void;
  onUpdate: (updatedAppointment: Appointment) => void;
}

const CompletionModal: React.FC<CompletionModalProps> = ({ appointment, onClose, onUpdate }) => {
  const { token } = useAppSelector((state) => state.auth);
  const [loading, setLoading] = useState(false);
  const [prescriptionType, setPrescriptionType] = useState<'manual' | 'digital'>('manual');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'online'>('cash');
  const [prescriptionUrls, setPrescriptionUrls] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  const handleComplete = async () => {
    setLoading(true);
    try {
      const API_URL = import.meta.env.VITE_API_URL;
      const response = await axios.put(
        `${API_URL}/appointments/${appointment.id}/complete`,
        {
          prescriptionUrls: JSON.stringify(prescriptionUrls),
          prescriptionType: prescriptionType,
          paymentMethod: paymentMethod,
          notes: notes
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      onUpdate(response.data.appointment);
      onClose();
    } catch (error) {
      console.error('Failed to complete visit:', error);
      alert('Failed to complete visit. Please check all fields.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col transition-colors">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Complete Patient Visit</h3>
            <p className="text-sm text-gray-500">Patient: {appointment.patient?.firstName} {appointment.patient?.lastName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-grow space-y-6">
          {/* Prescription Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Prescription Type</label>
            <div className="flex gap-4">
              <button
                onClick={() => setPrescriptionType('manual')}
                className={`flex-1 py-3 px-4 rounded-xl border-2 transition-all ${
                  prescriptionType === 'manual' 
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/20 text-primary-700 dark:text-primary-400' 
                    : 'border-gray-100 dark:border-gray-700 text-gray-500'
                }`}
              >
                Manual (Upload Photo)
              </button>
              <button
                onClick={() => setPrescriptionType('digital')}
                className={`flex-1 py-3 px-4 rounded-xl border-2 transition-all ${
                  prescriptionType === 'digital' 
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/20 text-primary-700 dark:text-primary-400' 
                    : 'border-gray-100 dark:border-gray-700 text-gray-500'
                }`}
              >
                Digital (Type Notes)
              </button>
            </div>
          </div>

          {/* Scribing Content */}
          {prescriptionType === 'manual' ? (
            <div className="space-y-4 animate-fade-in">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Upload Prescription Images</label>
              <FileUpload 
                multiple={true}
                onUploadSuccess={(urls) => setPrescriptionUrls(prev => [...prev, ...urls])}
              />
              <div className="flex gap-2 flex-wrap">
                {prescriptionUrls.map((url, i) => (
                  <div key={i} className="relative w-20 h-20 bg-gray-100 rounded-lg overflow-hidden border">
                    <img src={import.meta.env.VITE_API_URL.replace('/api', '') + url} alt="upload" className="w-full h-full object-cover" />
                    <button 
                      onClick={() => setPrescriptionUrls(prev => prev.filter((_, idx) => idx !== i))}
                      className="absolute top-0 right-0 bg-red-500 text-white rounded-bl-lg p-1"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4 animate-fade-in">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Digital Prescription Notes</label>
              <textarea 
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Enter diagnosis, medicines, and advice..."
                className="w-full p-4 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white min-h-[150px] focus:ring-2 focus:ring-primary-500 outline-none transition-all"
              />
            </div>
          )}

          {/* Payment Method */}
          <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Payment Method</label>
            <div className="flex gap-4">
              <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                paymentMethod === 'cash' ? 'border-green-500 bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400' : 'border-gray-100 dark:border-gray-700 text-gray-500'
              }`}>
                <input type="radio" className="hidden" name="payment" value="cash" checked={paymentMethod === 'cash'} onChange={() => setPaymentMethod('cash')} />
                <span className="font-medium">Cash</span>
              </label>
              <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                paymentMethod === 'online' ? 'border-green-500 bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400' : 'border-gray-100 dark:border-gray-700 text-gray-500'
              }`}>
                <input type="radio" className="hidden" name="payment" value="online" checked={paymentMethod === 'online'} onChange={() => setPaymentMethod('online')} />
                <span className="font-medium">Online (UPI/Card)</span>
              </label>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex gap-4">
          <button
            onClick={onClose}
            className="flex-1 py-3 text-gray-600 dark:text-gray-400 font-bold hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
          >
            Go Back
          </button>
          <button
            onClick={handleComplete}
            disabled={loading || (prescriptionType === 'manual' && prescriptionUrls.length === 0)}
            className="flex-[2] py-3 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl shadow-lg shadow-primary-500/30 transition-all disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Complete Visit & Generate Bill'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CompletionModal;
