package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type BlogPost struct {
	ID        uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	Title     string    `gorm:"not null" json:"title"`
	Content   string    `gorm:"type:text;not null" json:"content"`
	ImageURL  string    `json:"imageUrl"`
	AuthorID  uuid.UUID `gorm:"type:uuid;not null" json:"authorId"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`

	// Associations
	Author User `gorm:"foreignKey:AuthorID" json:"author,omitempty"`
}

// BeforeCreate hook to generate UUID
func (b *BlogPost) BeforeCreate(tx *gorm.DB) error {
	if b.ID == uuid.Nil {
		b.ID = uuid.New()
	}
	return nil
}

// TableName specifies the table name for BlogPost model
func (BlogPost) TableName() string {
	return "blog_posts"
}
