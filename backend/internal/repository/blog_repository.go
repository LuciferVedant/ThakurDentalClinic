package repository

import (
	"thakur-dental-clinic/backend/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type BlogRepository struct {
	db *gorm.DB
}

func NewBlogRepository(db *gorm.DB) *BlogRepository {
	return &BlogRepository{db: db}
}

func (r *BlogRepository) CreateBlogPost(post *models.BlogPost) error {
	return r.db.Create(post).Error
}

func (r *BlogRepository) GetBlogPostByID(id uuid.UUID) (*models.BlogPost, error) {
	var post models.BlogPost
	if err := r.db.Preload("Author").First(&post, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &post, nil
}

func (r *BlogRepository) GetAllBlogPosts() ([]models.BlogPost, error) {
	var posts []models.BlogPost
	if err := r.db.Preload("Author").Order("created_at desc").Find(&posts).Error; err != nil {
		return nil, err
	}
	return posts, nil
}

func (r *BlogRepository) UpdateBlogPost(post *models.BlogPost) error {
	return r.db.Save(post).Error
}

func (r *BlogRepository) DeleteBlogPost(id uuid.UUID) error {
	return r.db.Delete(&models.BlogPost{}, "id = ?", id).Error
}
