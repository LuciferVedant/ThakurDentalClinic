import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL;

export interface BlogPost {
  id: string;
  title: string;
  content: string;
  imageUrl: string;
  authorId: string;
  createdAt: string;
  updatedAt: string;
  author?: {
    firstName: string;
    lastName: string;
  };
}

interface BlogState {
  posts: BlogPost[];
  currentPost: BlogPost | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: BlogState = {
  posts: [],
  currentPost: null,
  isLoading: false,
  error: null,
};

// Async thunks
export const fetchBlogPosts = createAsyncThunk(
  'blog/fetchBlogPosts',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_URL}/blogs`);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch blogs');
    }
  }
);

export const fetchBlogPost = createAsyncThunk(
  'blog/fetchBlogPost',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_URL}/blogs/${id}`);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch blog post');
    }
  }
);

export const createBlogPost = createAsyncThunk(
  'blog/createBlogPost',
  async (postData: { title: string; content: string; imageUrl: string }, { getState, rejectWithValue }) => {
    try {
      const state = getState() as any;
      const response = await axios.post(`${API_URL}/api/blogs`, postData, {
        headers: { Authorization: `Bearer ${state.auth.token}` },
      });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to create blog post');
    }
  }
);

export const updateBlogPost = createAsyncThunk(
  'blog/updateBlogPost',
  async ({ id, data }: { id: string; data: { title: string; content: string; imageUrl: string } }, { getState, rejectWithValue }) => {
    try {
      const state = getState() as any;
      const response = await axios.put(`${API_URL}/api/blogs/${id}`, data, {
        headers: { Authorization: `Bearer ${state.auth.token}` },
      });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to update blog post');
    }
  }
);

export const deleteBlogPost = createAsyncThunk(
  'blog/deleteBlogPost',
  async (id: string, { getState, rejectWithValue }) => {
    try {
      const state = getState() as any;
      await axios.delete(`${API_URL}/api/blogs/${id}`, {
        headers: { Authorization: `Bearer ${state.auth.token}` },
      });
      return id;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to delete blog post');
    }
  }
);

const blogSlice = createSlice({
  name: 'blog',
  initialState,
  reducers: {
    clearCurrentPost: (state) => {
      state.currentPost = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch all posts
    builder
      .addCase(fetchBlogPosts.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchBlogPosts.fulfilled, (state, action: PayloadAction<BlogPost[]>) => {
        state.isLoading = false;
        state.posts = action.payload;
      })
      .addCase(fetchBlogPosts.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Fetch single post
    builder
      .addCase(fetchBlogPost.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchBlogPost.fulfilled, (state, action: PayloadAction<BlogPost>) => {
        state.isLoading = false;
        state.currentPost = action.payload;
      })
      .addCase(fetchBlogPost.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Create post
    builder
      .addCase(createBlogPost.fulfilled, (state, action: PayloadAction<BlogPost>) => {
        state.posts.unshift(action.payload);
      });

    // Update post
    builder
      .addCase(updateBlogPost.fulfilled, (state, action: PayloadAction<BlogPost>) => {
        const index = state.posts.findIndex((p) => p.id === action.payload.id);
        if (index !== -1) {
          state.posts[index] = action.payload;
        }
        if (state.currentPost?.id === action.payload.id) {
          state.currentPost = action.payload;
        }
      });

    // Delete post
    builder
      .addCase(deleteBlogPost.fulfilled, (state, action: PayloadAction<string>) => {
        state.posts = state.posts.filter((p) => p.id !== action.payload);
        if (state.currentPost?.id === action.payload) {
          state.currentPost = null;
        }
      });
  },
});

export const { clearCurrentPost } = blogSlice.actions;
export default blogSlice.reducer;
