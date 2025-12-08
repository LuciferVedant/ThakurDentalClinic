import React, { useState } from 'react';
import axios from 'axios';
import { useAppSelector } from '../../store/hooks';

interface FileUploadProps {
  onUploadSuccess: (urls: string[]) => void;
  multiple?: boolean;
  accept?: string;
  label?: string;
  className?: string;
}

const FileUpload: React.FC<FileUploadProps> = ({ 
  onUploadSuccess, 
  multiple = false, 
  accept = "image/*", 
  label = "Upload File(s)",
  className = ""
}) => {
  const { token } = useAppSelector((state) => state.auth);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    setUploading(true);
    setError(null);

    const files = Array.from(e.target.files);
    const uploadedUrls: string[] = [];

    try {
      const API_URL = import.meta.env.VITE_API_URL;

      // Upload files sequentially (or parallel, but sequential is safer for error handling)
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);

        const response = await axios.post(`${API_URL}/upload`, formData, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        });

        uploadedUrls.push(response.data.url); // Assuming backend returns { url: "..." }
      }

      onUploadSuccess(uploadedUrls);
    } catch (err: any) {
      console.error('Upload failed:', err);
      setError('Failed to upload file(s). Please try again.');
    } finally {
      setUploading(false);
      // Reset input
      e.target.value = '';
    }
  };

  return (
    <div className={`relative ${className}`}>
        <label className={`
            inline-flex items-center justify-center px-4 py-2 
            bg-white border border-gray-300 rounded-lg shadow-sm 
            text-sm font-medium text-gray-700 hover:bg-gray-50 
            focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500
            cursor-pointer transition-colors
            ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
        `}>
            {uploading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Uploading...
                </>
            ) : (
                <>
                   <svg className="w-5 h-5 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                   </svg>
                   {label}
                </>
            )}
            <input 
                type="file" 
                className="hidden" 
                multiple={multiple} 
                accept={accept} 
                onChange={handleFileChange}
                disabled={uploading}
            />
        </label>
        {error && <p className="text-red-500 text-xs mt-1 absolute bottom-[-20px] left-0 w-full truncate">{error}</p>}
    </div>
  );
};

export default FileUpload;
