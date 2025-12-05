import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { fetchBlogPosts, type BlogPost } from '../store/slices/blogSlice';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from 'react-i18next';

const BlogListPage: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { posts, isLoading, error } = useAppSelector((state) => state.blog);

  useEffect(() => {
    dispatch(fetchBlogPosts());
  }, [dispatch]);

  return (
    <div className="min-h-screen bg-background font-sans">
      <Navbar />

      <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 bg-secondary/20 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <h1 className="text-4xl font-bold text-foreground">{t('blog.title')}</h1>
            <p className="mt-4 text-xl text-muted-foreground">{t('blog.subtitle')}</p>
          </motion.div>

          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">{t('blog.loading')}</div>
          ) : error ? (
            <div className="text-center py-12 text-destructive">{error}</div>
          ) : (
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {posts.map((post: BlogPost, index: number) => (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                >
                  <Link to={`/blogs/${post.id}`}>
                    <Card className="h-full overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-none shadow-md">
                      <div className="aspect-video w-full overflow-hidden">
                        <img 
                          className="w-full h-full object-cover transition-transform duration-500 hover:scale-105" 
                          src={post.imageUrl || 'https://via.placeholder.com/400x200'} 
                          alt={post.title} 
                        />
                      </div>
                      <CardHeader className="p-6 pb-4">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="secondary" className="uppercase tracking-wider">
                            {t('blog.category')}
                          </Badge>
                        </div>
                        <h3 className="text-xl font-bold text-foreground line-clamp-2 leading-tight">
                          {post.title}
                        </h3>
                      </CardHeader>
                      <CardContent className="p-6 pt-0">
                        <p className="text-muted-foreground line-clamp-3 text-sm">
                          {post.content}
                        </p>
                      </CardContent>
                      <CardFooter className="p-6 pt-0 flex items-center mt-auto">
                        <Avatar className="h-8 w-8 mr-3">
                          <AvatarImage src={`https://ui-avatars.com/api/?name=${post.author?.firstName}+${post.author?.lastName}`} />
                          <AvatarFallback>{post.author?.firstName?.[0]}</AvatarFallback>
                        </Avatar>
                        <div className="text-sm">
                          <p className="font-medium text-foreground">
                            {post.author?.firstName} {post.author?.lastName}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {new Date(post.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </CardFooter>
                    </Card>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BlogListPage;
