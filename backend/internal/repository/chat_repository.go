package repository

import (
	"thakur-dental-clinic/backend/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type ChatRepository struct {
	db *gorm.DB
}

func NewChatRepository(db *gorm.DB) *ChatRepository {
	return &ChatRepository{db: db}
}

func (r *ChatRepository) CreateSession(userID *uuid.UUID) (*models.ChatSession, error) {
	session := &models.ChatSession{
		UserID: userID,
	}
	if err := r.db.Create(session).Error; err != nil {
		return nil, err
	}
	return session, nil
}

func (r *ChatRepository) GetSession(sessionID uuid.UUID) (*models.ChatSession, error) {
	var session models.ChatSession
	if err := r.db.Preload("Messages").First(&session, "id = ?", sessionID).Error; err != nil {
		return nil, err
	}
	return &session, nil
}

func (r *ChatRepository) AddMessage(sessionID uuid.UUID, role string, content string) (*models.ChatMessage, error) {
	message := &models.ChatMessage{
		SessionID: sessionID,
		Role:      role,
		Content:   content,
	}
	if err := r.db.Create(message).Error; err != nil {
		return nil, err
	}
	return message, nil
}

func (r *ChatRepository) GetHistory(userID uuid.UUID) ([]models.ChatSession, error) {
	var sessions []models.ChatSession
	// Order by updated_at desc to show recent chats first
	if err := r.db.Preload("Messages").Where("user_id = ?", userID).Order("updated_at desc").Find(&sessions).Error; err != nil {
		return nil, err
	}
	return sessions, nil
}
