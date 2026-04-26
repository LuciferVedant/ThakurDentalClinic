import React, { useState, useEffect, useRef } from 'react';
import { Plus, Upload, Image as ImageIcon, Loader2, Trash2, GripVertical } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { createBlogPost, updateBlogPost, fetchBlogPost, clearCurrentPost, uploadImages } from '../store/slices/blogSlice';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

const STATIC_URL = (import.meta.env.VITE_API_URL || '').replace(/\/api\/?$/, '');

interface AdminBlogEditorProps {
  postId: string | null;
  onClose: () => void;
}

interface ImageItem {
  id: string;
  url: string;
  file?: File;
  isUploading?: boolean;
  isNew?: boolean;
}

const AdminBlogEditor: React.FC<AdminBlogEditorProps> = ({ postId, onClose }) => {
  const dispatch = useAppDispatch();
  const { currentPost, isLoading } = useAppSelector((state) => state.blog);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation();
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [images, setImages] = useState<ImageItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  useEffect(() => {
    if (postId) {
      dispatch(fetchBlogPost(postId));
    } else {
      dispatch(clearCurrentPost());
      setTitle('');
      setContent('');
      setImages([]);
    }
  }, [dispatch, postId]);

  useEffect(() => {
    if (currentPost && postId) {
      setTitle(currentPost.title);
      setContent(currentPost.content);
      // Convert existing URLs to image items
      const existingImages = (currentPost.imageUrls || []).map((url, index) => ({
        id: `existing-${index}`,
        url: url.startsWith('http') ? url : `${STATIC_URL}${url.startsWith('/') ? '' : '/'}${url}`,
        isNew: false,
      }));
      setImages(existingImages);
    }
  }, [currentPost, postId]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = Array.from(e.dataTransfer.files).filter(file => 
      file.type.startsWith('image/')
    );
    
    if (files.length > 0) {
      handleFiles(files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      handleFiles(files);
    }
  };

  const handleFiles = async (files: File[]) => {
    // Check total limit
    if (images.length + files.length > 10) {
      alert('Maximum 10 images allowed');
      return;
    }

    // Create temporary preview items
    const newItems: ImageItem[] = files.map((file, index) => ({
      id: `temp-${Date.now()}-${index}`,
      url: URL.createObjectURL(file),
      file,
      isUploading: true,
      isNew: true,
    }));

    setImages(prev => [...prev, ...newItems]);
    setUploadProgress(`Uploading ${files.length} image(s)...`);

    // Upload files
    const dataTransfer = new DataTransfer();
    files.forEach(file => dataTransfer.items.add(file));
    const fileList = dataTransfer.files;

    try {
      const result = await dispatch(uploadImages(fileList)).unwrap();
      
      if (result.urls && result.urls.length > 0) {
        // Replace temporary items with uploaded URLs
        setImages(prev => {
          const withoutTemp = prev.filter(img => !newItems.find(ni => ni.id === img.id));
          const uploadedImages = result.urls.map((url: string, index: number) => ({
            id: `uploaded-${Date.now()}-${index}`,
            url: url.startsWith('http') ? url : `${STATIC_URL}${url.startsWith('/') ? '' : '/'}${url}`,
            isNew: false,
          }));
          return [...withoutTemp, ...uploadedImages];
        });
        
        if (result.errors && result.errors.length > 0) {
          console.warn('Some files failed to upload:', result.errors);
        }
      }
    } catch (error) {
      console.error('Upload failed:', error);
      // Remove temporary items on failure
      setImages(prev => prev.filter(img => !newItems.find(ni => ni.id === img.id)));
      alert('Failed to upload images. Please try again.');
    } finally {
      setUploadProgress(null);
    }
  };

  const removeImage = (id: string) => {
    setImages(prev => {
      const image = prev.find(img => img.id === id);
      if (image && image.url.startsWith('blob:')) {
        URL.revokeObjectURL(image.url);
      }
      return prev.filter(img => img.id !== id);
    });
  };

  const moveImage = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= images.length) return;
    
    setImages(prev => {
      const newImages = [...prev];
      [newImages[index], newImages[newIndex]] = [newImages[newIndex], newImages[index]];
      return newImages;
    });
  };

  const addImageUrl = () => {
    const url = prompt('Enter image URL:');
    if (url && url.trim()) {
      setImages(prev => [...prev, {
        id: `url-${Date.now()}`,
        url: url.trim(),
        isNew: false,
      }]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Get all image URLs (both uploaded and external)
    const imageUrls = images.map(img => {
      // If it's a full URL from our API, extract just the path
      if (img.url.includes(STATIC_URL)) {
        return img.url.replace(STATIC_URL, '');
      }
      return img.url;
    }).filter(url => url.trim() !== '');
    
    if (postId) {
      await dispatch(updateBlogPost({ 
        id: postId, 
        data: { title, content, imageUrls } 
      }));
    } else {
      await dispatch(createBlogPost({ title, content, imageUrls }));
    }
    onClose();
  };

  return (
    <div className="bg-white dark:bg-gray-800 shadow sm:rounded-lg p-6 transition-colors">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          {postId ? t('dashboard.editBlogPost') : t('dashboard.createBlogPost')}
        </h2>
        <button
          onClick={onClose}
          className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
        >
          {t('dashboard.cancel')}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('dashboard.title')}</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-2 border text-gray-900 bg-white dark:bg-gray-800 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('dashboard.images')}</label>
          
          {/* Drag & Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
              dragOver 
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30' 
                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/50'
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <p className="text-sm text-gray-600 dark:text-gray-300">
              <span className="font-medium text-primary-600 dark:text-primary-400">{t('dashboard.clickToUpload')}</span> {t('dashboard.dragAndDrop')}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('dashboard.imageFormats')}</p>
          </div>

          {/* Upload Progress */}
          {uploadProgress && (
            <div className="mt-3 flex items-center text-sm text-primary-600">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {uploadProgress}
            </div>
          )}

          {/* Image Count */}
          {images.length > 0 && (
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {images.length} image{images.length !== 1 ? 's' : ''} 
              {images.length === 10 && ' (maximum reached)'}
            </p>
          )}

          {/* Image Previews */}
          {images.length > 0 && (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {images.map((image, index) => (
                <div 
                  key={image.id} 
                  className="relative group aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-100"
                >
                  <img
                    src={image.url}
                    alt={`Preview ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  
                  {/* Overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    {/* Move Up */}
                    {index > 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          moveImage(index, 'up');
                        }}
                        className="p-1.5 bg-white/90 rounded-full mx-1 hover:bg-white transition-colors"
                        title="Move up"
                      >
                        <GripVertical className="w-4 h-4 text-gray-700 rotate-90" />
                      </button>
                    )}
                    
                    {/* Move Down */}
                    {index < images.length - 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          moveImage(index, 'down');
                        }}
                        className="p-1.5 bg-white/90 rounded-full mx-1 hover:bg-white transition-colors"
                        title="Move down"
                      >
                        <GripVertical className="w-4 h-4 text-gray-700 -rotate-90" />
                      </button>
                    )}
                    
                    {/* Remove */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeImage(image.id);
                      }}
                      className="p-1.5 bg-red-500/90 rounded-full mx-1 hover:bg-red-500 transition-colors"
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4 text-white" />
                    </button>
                  </div>

                  {/* Index Badge */}
                  <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                    {index + 1}
                  </div>

                  {/* Loading Indicator */}
                  {image.isUploading && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <Loader2 className="w-8 h-8 text-white animate-spin" />
                    </div>
                  )}
                </div>
              ))}
              
              {/* Add More Button */}
              {images.length < 10 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-square rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
                >
                  <Plus className="w-8 h-8 mb-1" />
                  <span className="text-xs">{t('dashboard.addMore')}</span>
                </button>
              )}
            </div>
          )}

          {/* Add URL Button */}
          <button
            type="button"
            onClick={addImageUrl}
            className="mt-3 inline-flex items-center text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
          >
            <ImageIcon className="w-4 h-4 mr-1" /> {t('dashboard.addImageUrl')}
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('dashboard.content')}</label>
          <textarea
            required
            rows={10}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-2 border text-gray-900 bg-white dark:bg-gray-800 dark:text-white"
          />
        </div>

        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
          >
            {t('dashboard.cancel')}
          </button>
          <button
            type="submit"
            disabled={isLoading || !!uploadProgress}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
          >
            {isLoading ? t('dashboard.saving') : t('dashboard.savePost')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AdminBlogEditor;
