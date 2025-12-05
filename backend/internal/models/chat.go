package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type ChatSession struct {
	ID        uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	UserID    *uuid.UUID     `gorm:"type:uuid" json:"userId,omitempty"`
	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
	Messages  []ChatMessage  `gorm:"foreignKey:SessionID" json:"messages,omitempty"`
}

type ChatMessage struct {
	ID        uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	SessionID uuid.UUID `gorm:"type:uuid;not null" json:"sessionId"`
	Role      string    `gorm:"not null" json:"role"` // "user" or "model"
	Content   string    `gorm:"not null" json:"content"`
	CreatedAt time.Time `json:"createdAt"`
}

func (s *ChatSession) BeforeCreate(tx *gorm.DB) error {
	if s.ID == uuid.Nil {
		s.ID = uuid.New()
	}
	return nil
}

func (m *ChatMessage) BeforeCreate(tx *gorm.DB) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	return nil
}
