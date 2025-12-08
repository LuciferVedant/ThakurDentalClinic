package handlers

import (
	"net/http"
	"thakur-dental-clinic/backend/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type ChatHandler struct {
	service *services.ChatService
}

func NewChatHandler(service *services.ChatService) *ChatHandler {
	return &ChatHandler{service: service}
}

type ChatRequest struct {
	Message   string `json:"message" binding:"required"`
	SessionID string `json:"sessionId"`
}

func (h *ChatHandler) HandleChat(c *gin.Context) {
	var req ChatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var sessionID *uuid.UUID
	if req.SessionID != "" {
		id, err := uuid.Parse(req.SessionID)
		if err == nil {
			sessionID = &id
		}
	}

	// Check if user is logged in (optional)
	var userID *uuid.UUID
	if id, exists := c.Get("userID"); exists {
		uid := id.(uuid.UUID)
		userID = &uid
	}

	userMsg, modelMsg, sid, err := h.service.SendMessage(userID, sessionID, req.Message)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"userMessage":  userMsg,
		"modelMessage": modelMsg,
		"sessionId":    sid.String(),
	})
}

func (h *ChatHandler) GetHistory(c *gin.Context) {
	id, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	userID := id.(uuid.UUID)

	sessions, err := h.service.GetHistory(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, sessions)
}

func (h *ChatHandler) GetSessionMessages(c *gin.Context) {
	sessionIDStr := c.Param("sessionId")
	sessionID, err := uuid.Parse(sessionIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid session ID"})
		return
	}

	messages, err := h.service.GetSessionMessages(sessionID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, messages)
}

func (h *ChatHandler) DeleteHistory(c *gin.Context) {
	id, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	userID := id.(uuid.UUID)

	if err := h.service.DeleteHistory(userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Chat history deleted successfully"})
}

func (h *ChatHandler) DeleteSession(c *gin.Context) {
	sessionIDStr := c.Param("sessionId")
	sessionID, err := uuid.Parse(sessionIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid session ID"})
		return
	}

	if err := h.service.DeleteSession(sessionID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Chat session deleted successfully"})
}
