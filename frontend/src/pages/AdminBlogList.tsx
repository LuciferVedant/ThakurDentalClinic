import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { fetchBlogPosts, deleteBlogPost, type BlogPost } from '../store/slices/blogSlice';
import AdminBlogEditor from './AdminBlogEditor';

const STATIC_URL = (import.meta.env.VITE_API_URL || '').replace(/\/api\/?$/, '');

const AdminBlogList: React.FC = () => {
  const dispatch = useAppDispatch();
  const { posts, isLoading } = useAppSelector((state) => state.blog);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  useEffect(() => {
    dispatch(fetchBlogPosts());
  }, [dispatch]);

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this post?')) {
      await dispatch(deleteBlogPost(id));
    }
  };

  const handleEdit = (id: string) => {
    setSelectedPostId(id);
    setIsEditorOpen(true);
  };

  const handleCreate = () => {
    setSelectedPostId(null);
    setIsEditorOpen(true);
  };

  const handleCloseEditor = () => {
    setIsEditorOpen(false);
    setSelectedPostId(null);
  };

  if (isEditorOpen) {
    return (
      <AdminBlogEditor
        postId={selectedPostId}
        onClose={handleCloseEditor}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Blog Management</h2>
        <button
          onClick={handleCreate}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          Create New Post
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-gray-600 dark:text-gray-400">Loading...</div>
      ) : (
        <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-md transition-colors">
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {posts.map((post: BlogPost) => {
              const firstImage = (post.imageUrls && post.imageUrls.length > 0) ? post.imageUrls[0] : post.imageUrl;
              return (
              <li key={post.id}>
                <div className="px-4 py-4 sm:px-6 flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10">
                      <img
                        className="h-10 w-10 rounded-full object-cover"
                        src={firstImage?.startsWith('/') ? `${STATIC_URL}${firstImage}` : (firstImage || 'https://via.placeholder.com/100')}
                        alt=""
                      />
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-primary-600 dark:text-primary-400">{post.title}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {new Date(post.createdAt).toLocaleDateString()} • {post.author?.firstName} {post.author?.lastName}
                      </div>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEdit(post.id)}
                      className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 text-sm font-medium transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(post.id)}
                      className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 text-sm font-medium transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
              );
            })}
            {posts.length === 0 && (
              <li className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                No blog posts found. Create one to get started!
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default AdminBlogList;
