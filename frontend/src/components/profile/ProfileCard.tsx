import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { updateProfile } from '../../store/slices/authSlice';
import FileUpload from '../common/FileUpload';

const ProfileCard: React.FC = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    age: user?.age || '',
    gender: user?.gender || '',
    address: user?.address || '',
    phone: user?.phone || '',
    profilePicture: user?.profilePicture || '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    dispatch(updateProfile({
      ...formData,
      age: formData.age ? Number(formData.age) : undefined,
    }));
    setIsEditing(false);
  };

  if (!user) return null;

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-100">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold text-gray-900">My Profile</h3>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="text-primary-600 hover:text-primary-700 font-medium text-sm"
        >
          {isEditing ? 'Cancel' : 'Edit Profile'}
        </button>
      </div>

      {isEditing ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
              <input
                type="number"
                name="age"
                value={formData.age}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
              <select
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleChange}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
             <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
               <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
             <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Profile Picture</label>
               <FileUpload
                  onUploadSuccess={(urls) => setFormData(prev => ({ ...prev, profilePicture: urls[0] }))}
                  multiple={false}
                  label="Upload Profile Picture"
               />
               {formData.profilePicture && (
                  <p className="mt-2 text-xs text-gray-500 truncate">Selected: {formData.profilePicture}</p>
               )}
            </div>
          </div>
          <div className="flex justify-end pt-4">
            <button
              type="submit"
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
            >
              Save Changes
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex-shrink-0">
             <div className="w-24 h-24 rounded-full bg-gray-200 overflow-hidden shadow-inner">
                {user.profilePicture ? (
                    <img src={user.profilePicture} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                    </div>
                )}
             </div>
          </div>
          <div className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            <div>
              <p className="text-sm text-gray-500">Full Name</p>
              <p className="font-medium text-gray-900">{user.firstName} {user.lastName}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Email</p>
              <p className="font-medium text-gray-900">{user.email}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Age</p>
              <p className="font-medium text-gray-900">{user.age || 'Not set'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Gender</p>
              <p className="font-medium text-gray-900">{user.gender || 'Not set'}</p>
            </div>
             <div>
              <p className="text-sm text-gray-500">Phone</p>
              <p className="font-medium text-gray-900">{user.phone || 'Not set'}</p>
            </div>
            <div className="md:col-span-2">
              <p className="text-sm text-gray-500">Address</p>
              <p className="font-medium text-gray-900">{user.address || 'Not set'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileCard;
