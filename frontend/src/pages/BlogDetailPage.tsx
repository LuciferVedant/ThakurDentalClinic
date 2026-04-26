import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, X, ChevronLeft, ChevronRight, Images } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { fetchBlogPost, clearCurrentPost } from '../store/slices/blogSlice';
import Navbar from '@/components/Navbar';
import ImageCarousel from '@/components/ImageCarousel';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

const STATIC_URL = (import.meta.env.VITE_API_URL || '').replace(/\/api\/?$/, '');

const BlogDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const dispatch = useAppDispatch();
  const { currentPost, isLoading, error } = useAppSelector((state) => state.blog);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);

  // Process image URLs to ensure they're complete
  const processedImageUrls = useMemo(() => {
    if (!currentPost?.imageUrls) return [];
    return currentPost.imageUrls.map(url => {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
      }
      return `${STATIC_URL}${url.startsWith('/') ? '' : '/'}${url}`;
    });
  }, [currentPost?.imageUrls]);

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

          {/* Hero Image Gallery */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mb-10"
          >
            <ImageCarousel 
              images={currentPost.imageUrls || [currentPost.imageUrl]}
              alt={currentPost.title}
              aspectRatio="video"
              showDots={(currentPost.imageUrls?.length || 0) > 1}
              showArrows={(currentPost.imageUrls?.length || 0) > 1}
              autoPlay={true}
              autoPlayInterval={6000}
              variant="gallery"
              onImageClick={(index) => setSelectedImageIndex(index)}
              className="shadow-2xl"
            />
          </motion.div>

          {/* Thumbnail Gallery Grid */}
          {processedImageUrls.length > 1 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="mb-10"
            >
              <div className="flex items-center gap-2 mb-4">
                <Images className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground font-medium">
                  {processedImageUrls.length} Photos
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {processedImageUrls.map((url, index) => (
                  <motion.button
                    key={index}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setSelectedImageIndex(index)}
                    className={cn(
                      'relative aspect-square rounded-xl overflow-hidden shadow-md transition-all duration-300',
                      'ring-2 ring-offset-2 ring-offset-background',
                      selectedImageIndex === index ? 'ring-primary' : 'ring-transparent hover:ring-primary/50'
                    )}
                  >
                    <img
                      src={url}
                      alt={`${currentPost.title} - ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors duration-200" />
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Fullscreen Image Lightbox */}
          <AnimatePresence>
            {selectedImageIndex !== null && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex items-center justify-center"
                onClick={() => setSelectedImageIndex(null)}
              >
                {/* Close Button */}
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setSelectedImageIndex(null)}
                  className="absolute top-6 right-6 z-50 bg-white/10 hover:bg-white/20 text-white p-3 rounded-full backdrop-blur-sm transition-colors"
                >
                  <X className="w-6 h-6" />
                </motion.button>

                {/* Navigation Arrows */}
                {processedImageUrls.length > 1 && (
                  <>
                    <motion.button
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedImageIndex(prev => 
                          prev !== null && prev > 0 ? prev - 1 : processedImageUrls.length - 1
                        );
                      }}
                      className="absolute left-6 top-1/2 -translate-y-1/2 z-50 bg-white/10 hover:bg-white/20 text-white p-3 rounded-full backdrop-blur-sm transition-colors"
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </motion.button>
                    
                    <motion.button
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedImageIndex(prev => 
                          prev !== null && prev < processedImageUrls.length - 1 ? prev + 1 : 0
                        );
                      }}
                      className="absolute right-6 top-1/2 -translate-y-1/2 z-50 bg-white/10 hover:bg-white/20 text-white p-3 rounded-full backdrop-blur-sm transition-colors"
                    >
                      <ChevronRight className="w-6 h-6" />
                    </motion.button>
                  </>
                )}

                {/* Image Counter */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 bg-white/10 backdrop-blur-sm text-white text-sm font-medium px-4 py-2 rounded-full"
                >
                  {selectedImageIndex + 1} / {processedImageUrls.length}
                </motion.div>

                {/* Main Image */}
                <motion.div
                  key={selectedImageIndex}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  className="max-w-[90vw] max-h-[85vh] p-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  <img
                    src={processedImageUrls[selectedImageIndex]}
                    alt={`${currentPost.title} - Full view`}
                    className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
                  />
                </motion.div>

                {/* Thumbnail Strip */}
                {processedImageUrls.length > 1 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="absolute bottom-20 left-1/2 -translate-x-1/2 z-50 flex gap-2 px-4 py-3 bg-black/50 backdrop-blur-md rounded-2xl max-w-[80vw] overflow-x-auto"
                  >
                    {processedImageUrls.map((url, index) => (
                      <button
                        key={index}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedImageIndex(index);
                        }}
                        className={cn(
                          'relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 transition-all duration-200',
                          index === selectedImageIndex
                            ? 'ring-2 ring-white scale-110'
                            : 'opacity-50 hover:opacity-100'
                        )}
                      >
                        <img
                          src={url}
                          alt={`Thumbnail ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          
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
