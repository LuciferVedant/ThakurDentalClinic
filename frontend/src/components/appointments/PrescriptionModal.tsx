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
    } else if (appointment.prescriptionUrl) {
      urls = [appointment.prescriptionUrl];
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
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h3 className="text-xl font-bold text-gray-900">Prescription Details</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-grow">
        <div className="p-6 overflow-y-auto flex-grow">
          {currentUrls.length > 0 && !editMode ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                {currentUrls.map((url, idx) => (
                    <div key={idx} className="rounded-lg overflow-hidden border border-gray-200">
                        <img 
                        src={getFullUrl(url)} 
                        alt={`Prescription ${idx + 1}`} 
                        className="w-full h-auto object-contain max-h-[60vh]"
                        />
                    </div>
                ))}
              </div>
              {canEdit && (
                 <div className="flex justify-end">
                    <button 
                        onClick={() => setEditMode(true)}
                        className="text-primary-600 hover:text-primary-700 font-medium"
                    >
                        Edit / Add More
                    </button>
                 </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
               {currentUrls.length === 0 && !editMode && (
                  <div className="mb-6">
                    <p className="text-gray-500 mb-2">No prescription attached yet.</p>
                     {canEdit && (
                         <button 
                            onClick={() => setEditMode(true)}
                            className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition"
                        >
                            Upload Prescription
                        </button>
                     )}
                  </div>
               )}

              {editMode && (
                <div className="max-w-md mx-auto space-y-6">
                    <div>
                        <h4 className="font-medium text-gray-900 mb-4">Current Images</h4>
                         {currentUrls.map((url, idx) => (
                            <div key={idx} className="flex items-center justify-between bg-gray-50 p-2 rounded mb-2">
                                <span className="text-xs truncate max-w-[200px]">{url}</span>
                                <button onClick={() => removeUrl(idx)} className="text-red-500 hover:text-red-700 text-sm">Remove</button>
                            </div>
                         ))}
                    </div>

                    <div>
                        <h4 className="font-medium text-gray-900 mb-2">Add New Images</h4>
                        <FileUpload 
                            multiple={true}
                            onUploadSuccess={handleNewUploads}
                            label="Select Images"
                        />
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                        <button
                            type="button"
                            onClick={() => {
                                setCurrentUrls(existingUrls); // Reset changes
                                setEditMode(false);
                            }}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isUploading}
                            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                        >
                            {isUploading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </div>
              )}
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
};

export default PrescriptionModal;
