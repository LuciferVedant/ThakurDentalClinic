import React, { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { createBlogPost, updateBlogPost, fetchBlogPost, clearCurrentPost } from '../store/slices/blogSlice';

interface AdminBlogEditorProps {
  postId: string | null;
  onClose: () => void;
}

const AdminBlogEditor: React.FC<AdminBlogEditorProps> = ({ postId, onClose }) => {
  const dispatch = useAppDispatch();
  const { currentPost, isLoading } = useAppSelector((state) => state.blog);
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  useEffect(() => {
    if (postId) {
      dispatch(fetchBlogPost(postId));
    } else {
      dispatch(clearCurrentPost());
      setTitle('');
      setContent('');
      setImageUrl('');
    }
  }, [dispatch, postId]);

  useEffect(() => {
    if (currentPost && postId) {
      setTitle(currentPost.title);
      setContent(currentPost.content);
      setImageUrl(currentPost.imageUrl || '');
    }
  }, [currentPost, postId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (postId) {
      await dispatch(updateBlogPost({ id: postId, data: { title, content, imageUrl } }));
    } else {
      await dispatch(createBlogPost({ title, content, imageUrl }));
    }
    onClose();
  };

  return (
    <div className="bg-white shadow sm:rounded-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          {postId ? 'Edit Blog Post' : 'Create New Post'}
        </h2>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700"
        >
          Cancel
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700">Title</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-2 border"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Image URL</label>
          <input
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://example.com/image.jpg"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-2 border"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Content</label>
          <textarea
            required
            rows={10}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-2 border"
          />
        </div>

        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
          >
            {isLoading ? 'Saving...' : 'Save Post'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AdminBlogEditor;
