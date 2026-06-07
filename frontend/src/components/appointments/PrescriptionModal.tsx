import React, { useState, useMemo } from 'react';
import type { Appointment } from '../../types/appointment';
import axios from 'axios';
import { useAppSelector } from '../../store/hooks';
import FileUpload from '../common/FileUpload';

interface PrescriptionModalProps {
  appointment: Appointment;
  onClose: () => void;
  onUpdate: (updatedAppointment: Appointment) => void;
}

const PrescriptionModal: React.FC<PrescriptionModalProps> = ({ appointment, onClose, onUpdate }) => {
  const { user, token } = useAppSelector((state) => state.auth);
  const [isUploading, setIsUploading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [activePrint, setActivePrint] = useState<'prescription' | 'receipt' | null>(null);

  const handlePrint = (type: 'prescription' | 'receipt') => {
    setActivePrint(type);
    setTimeout(() => {
      window.print();
      setActivePrint(null);
    }, 150);
  };

  // Parse existing URLs
  const existingUrls = useMemo(() => {
    let urls: string[] = [];
    if (appointment.prescriptionUrls) {
      try {
        urls = JSON.parse(appointment.prescriptionUrls);
      } catch (e) {
        console.error("Failed to parse prescriptionUrls", e);
        // Fallback if it's a raw string (though it shouldn't be if logic holds)
        urls = [appointment.prescriptionUrls];
      }
    }
    return urls;
  }, [appointment]);

  const [currentUrls, setCurrentUrls] = useState<string[]>(existingUrls);

  const API_URL = import.meta.env.VITE_API_URL;
  // Wait, API_URL is usually http://localhost:8080/api. Uploads are at http://localhost:8080/uploads
  // So we need base URL.
  const getFullUrl = (url: string) => {
    if (url.startsWith('http')) return url;
    const baseUrl = API_URL.replace('/api', '');
    return `${baseUrl}${url}`;
  };

  // Allow doctors and receptionists to upload/edit
  const canEdit = user?.userType === 'doctor' || user?.userType === 'receptionist';

  const handleSave = async () => {
    if (currentUrls.length === 0) return;

    try {
      setIsUploading(true);
      const API_URL = import.meta.env.VITE_API_URL;
      const response = await axios.put(
        `${API_URL}/appointments/${appointment.id}/prescription`,
        { prescriptionUrls: currentUrls },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      onUpdate(response.data.appointment);
      setEditMode(false);
    } catch (error) {
      console.error('Failed to update prescription:', error);
      alert('Failed to update prescription');
    } finally {
      setIsUploading(false);
    }
  };

  const handleNewUploads = (urls: string[]) => {
      setCurrentUrls(prev => [...prev, ...urls]);
  };

  const removeUrl = (index: number) => {
      setCurrentUrls(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
            background: none !important;
            box-shadow: none !important;
          }
          .printable-modal-content, .printable-modal-content * {
            visibility: visible !important;
          }
          .printable-modal-content {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
          .print-hide {
            display: none !important;
          }
          h3, h4 {
            color: black !important;
            border-bottom: 1px solid #ddd !important;
            padding-bottom: 6px !important;
            margin-bottom: 12px !important;
          }
        }
      `}</style>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col transition-colors border border-gray-100 dark:border-gray-700 printable-modal-content">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/40 no-print">
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Visit Records & Billing</h3>
            <p className="text-xs text-gray-500 mt-1">Token #{appointment.queueNumber} • {new Date(appointment.dateTime).toLocaleDateString()}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-grow space-y-6 bg-gray-50/50 dark:bg-gray-900/20">
          {/* SECTION 1: PRESCRIPTION / CLINICAL NOTES */}
          <div className={`bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm space-y-4 ${activePrint === 'receipt' ? 'print-hide' : ''}`}>
            <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 border-b border-gray-100 dark:border-gray-700 pb-3">
              <svg className="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Clinical Records & Prescriptions
            </h4>

            {editMode ? (
              <div className="space-y-4">
                <div>
                  <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Current Prescription Images</h5>
                  {currentUrls.length === 0 ? (
                    <p className="text-xs text-gray-500 italic">No images uploaded.</p>
                  ) : (
                    <div className="space-y-2">
                      {currentUrls.map((url, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-gray-50 dark:bg-gray-900 p-2 rounded-lg border dark:border-gray-800">
                          <span className="text-xs truncate max-w-[250px] dark:text-gray-300">{url}</span>
                          <button onClick={() => removeUrl(idx)} className="text-red-500 hover:text-red-700 text-xs font-semibold">Remove</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-2">
                  <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Add New Scans</h5>
                  <FileUpload 
                    multiple={true}
                    onUploadSuccess={handleNewUploads}
                    label="Select Prescription Images"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t dark:border-gray-700">
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentUrls(existingUrls);
                      setEditMode(false);
                    }}
                    className="px-4 py-2 text-xs font-semibold bg-gray-100 hover:bg-gray-250 text-gray-700 dark:bg-gray-700 dark:text-gray-200 rounded-lg transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isUploading}
                    className="px-4 py-2 text-xs font-semibold bg-primary-600 hover:bg-primary-705 text-white rounded-lg transition disabled:opacity-50"
                  >
                    {isUploading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {appointment.notes && (
                  <div className="bg-primary-50/40 dark:bg-primary-950/10 p-4 rounded-xl border border-primary-100/50 dark:border-primary-900/30">
                    <p className="text-xs uppercase font-bold tracking-wider text-primary-600 dark:text-primary-400 mb-2">Doctor's Diagnosis & Notes</p>
                    <div className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed font-serif italic">
                      "{appointment.notes}"
                    </div>
                  </div>
                )}

                {currentUrls.length > 0 ? (
                  <div className="space-y-4">
                    <p className="text-xs uppercase font-bold tracking-wider text-gray-500 dark:text-gray-400">Attached Prescription Scans</p>
                    <div className="grid grid-cols-1 gap-4">
                      {currentUrls.map((url, idx) => (
                        <div key={idx} className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-2 flex justify-center">
                          <img 
                            src={getFullUrl(url)} 
                            alt={`Prescription Scan ${idx + 1}`} 
                            className="w-full h-auto max-h-[50vh] object-contain rounded"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  !appointment.notes && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No prescription records attached to this visit.</p>
                  )
                )}

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700/50 mt-4 no-print">
                  <button
                    onClick={() => handlePrint('prescription')}
                    className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-650 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-3a2 2 0 00-2-2H9a2 2 0 00-2 2v3a2 2 0 002 2zm5-17V7a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                    </svg>
                    Print Prescription
                  </button>
                  {canEdit && (
                    <button 
                      onClick={() => setEditMode(true)}
                      className="px-3 py-1.5 bg-primary-50 dark:bg-primary-950/20 hover:bg-primary-100 dark:hover:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-lg text-xs font-bold transition flex items-center gap-1"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                      Edit / Add Scans
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* SECTION 2: BILLING & PAYMENT RECEIPT */}
          {appointment.status === 'completed' && (
            <div className={`bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm relative overflow-hidden ${activePrint === 'prescription' ? 'print-hide' : ''}`}>
              <div className="absolute right-[-15px] top-[-10px] transform rotate-12 opacity-[0.03] dark:opacity-[0.05]">
                <svg className="w-24 h-24 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>

              <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-3 mb-4">
                <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 8h6m-6 2h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Invoice & Receipt Summary
                </h4>
                <span className="text-[10px] font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-gray-600 dark:text-gray-300">
                  REC-{appointment.id.substring(0, 8).toUpperCase()}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <div>
                    <span className="text-xs text-gray-400 block font-medium">Patient Name</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {appointment.patient?.firstName} {appointment.patient?.lastName}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block font-medium">Consulting Doctor</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      Dr. {appointment.doctor?.firstName} {appointment.doctor?.lastName}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block font-medium">Transaction Timestamp</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {appointment.actualEndTime 
                        ? new Date(appointment.actualEndTime).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) 
                        : new Date(appointment.dateTime).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
                      }
                    </span>
                  </div>
                </div>

                <div className="space-y-2 md:border-l md:border-gray-150 md:dark:border-gray-700 md:pl-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">Consultation Fee</span>
                    <span className="font-bold text-gray-900 dark:text-white">₹500.00</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">Tax / GST (18%)</span>
                    <span className="font-medium text-gray-900 dark:text-white">₹0.00 (Waived)</span>
                  </div>
                  <div className="flex justify-between items-center border-t border-dashed border-gray-200 dark:border-gray-700 pt-2 mt-2">
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400">Total Paid</span>
                    <span className="text-lg font-extrabold text-green-600 dark:text-green-400">₹500.00</span>
                  </div>
                  
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-xs text-gray-400">Payment Status</span>
                    <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-green-100 dark:bg-green-950/40 text-green-800 dark:text-green-300 rounded-full">
                      {appointment.paymentStatus || 'Paid'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">Payment Method</span>
                    <span className="font-semibold text-gray-900 dark:text-white capitalize flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                      {appointment.paymentMethod || 'cash'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-gray-100 dark:border-gray-700 mt-4 no-print">
                <button
                  onClick={() => handlePrint('receipt')}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-3a2 2 0 00-2-2H9a2 2 0 00-2 2v3a2 2 0 002 2zm5-17V7a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                  </svg>
                  Print Receipt
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 flex justify-end no-print">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-gray-900 hover:bg-black dark:bg-gray-700 dark:hover:bg-gray-600 text-white font-bold rounded-xl transition"
          >
            Close Records
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrescriptionModal;
