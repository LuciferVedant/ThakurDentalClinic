package services

import (
	"errors"
	"thakur-dental-clinic/backend/internal/models"
	"thakur-dental-clinic/backend/internal/repository"

	"github.com/google/uuid"
)

type BlogService struct {
	blogRepo *repository.BlogRepository
	userRepo *repository.UserRepository
}

func NewBlogService(blogRepo *repository.BlogRepository, userRepo *repository.UserRepository) *BlogService {
	return &BlogService{
		blogRepo: blogRepo,
		userRepo: userRepo,
	}
}

func (s *BlogService) CreateBlogPost(authorID uuid.UUID, title, content, imageURLs string) (*models.BlogPost, error) {
	// Verify author is admin doctor
	author, err := s.userRepo.GetUserByID(authorID)
	if err != nil {
		return nil, errors.New("author not found")
	}

	if !author.IsAdmin || author.UserType != models.UserTypeDoctor {
		return nil, errors.New("only admin doctors can create blog posts")
	}

	post := &models.BlogPost{
		Title:     title,
		Content:   content,
		ImageURLs: imageURLs,
		AuthorID:  authorID,
	}

	if err := s.blogRepo.CreateBlogPost(post); err != nil {
		return nil, err
	}

	return post, nil
}

func (s *BlogService) GetAllBlogPosts() ([]models.BlogPost, error) {
	return s.blogRepo.GetAllBlogPosts()
}

func (s *BlogService) GetBlogPost(id uuid.UUID) (*models.BlogPost, error) {
	return s.blogRepo.GetBlogPostByID(id)
}

func (s *BlogService) UpdateBlogPost(id uuid.UUID, editorID uuid.UUID, title, content, imageURLs string) (*models.BlogPost, error) {
	// Verify editor is admin doctor
	editor, err := s.userRepo.GetUserByID(editorID)
	if err != nil {
		return nil, errors.New("editor not found")
	}

	if !editor.IsAdmin || editor.UserType != models.UserTypeDoctor {
		return nil, errors.New("only admin doctors can update blog posts")
	}

	post, err := s.blogRepo.GetBlogPostByID(id)
	if err != nil {
		return nil, err
	}

	post.Title = title
	post.Content = content
	post.ImageURLs = imageURLs

	if err := s.blogRepo.UpdateBlogPost(post); err != nil {
		return nil, err
	}

	return post, nil
}

func (s *BlogService) DeleteBlogPost(id uuid.UUID, deleterID uuid.UUID) error {
	// Verify deleter is admin doctor
	deleter, err := s.userRepo.GetUserByID(deleterID)
	if err != nil {
		return errors.New("user not found")
	}

	if !deleter.IsAdmin || deleter.UserType != models.UserTypeDoctor {
		return errors.New("only admin doctors can delete blog posts")
	}

	return s.blogRepo.DeleteBlogPost(id)
}
