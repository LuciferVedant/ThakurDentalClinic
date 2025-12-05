import React, { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { fetchBlogPost, clearCurrentPost } from '../store/slices/blogSlice';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const BlogDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const dispatch = useAppDispatch();
  const { currentPost, isLoading, error } = useAppSelector((state) => state.blog);

  useEffect(() => {
    if (id) {
      dispatch(fetchBlogPost(id));
    }
    return () => {
      dispatch(clearCurrentPost());
    };
  }, [dispatch, id]);

  if (isLoading) return <div className="pt-32 text-center">Loading...</div>;
  if (error) return <div className="pt-32 text-center text-destructive">{error}</div>;
  if (!currentPost) return <div className="pt-32 text-center">Post not found</div>;

  return (
    <div className="min-h-screen bg-background font-sans">
      <Navbar />

      <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-4xl mx-auto"
        >
          <Link to="/blogs">
            <Button variant="ghost" className="mb-8 pl-0 hover:pl-2 transition-all">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Blogs
            </Button>
          </Link>

          <div className="aspect-video w-full overflow-hidden rounded-2xl shadow-lg mb-10">
            <img 
              className="w-full h-full object-cover" 
              src={currentPost.imageUrl || 'https://via.placeholder.com/800x400'} 
              alt={currentPost.title} 
            />
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6 leading-tight">{currentPost.title}</h1>
          
          <div className="flex items-center mb-10 pb-10 border-b border-border">
            <Avatar className="h-12 w-12 mr-4">
              <AvatarImage src={`https://ui-avatars.com/api/?name=${currentPost.author?.firstName}+${currentPost.author?.lastName}`} />
              <AvatarFallback>{currentPost.author?.firstName?.[0]}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium text-foreground text-lg">
                {currentPost.author?.firstName} {currentPost.author?.lastName}
              </p>
              <p className="text-muted-foreground">
                {new Date(currentPost.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="prose prose-lg prose-blue max-w-none text-foreground/80 whitespace-pre-wrap leading-relaxed">
            {currentPost.content}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default BlogDetailPage;
