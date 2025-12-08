package services

import (
	"context"
	"fmt"
	"log"
	"os"
	"thakur-dental-clinic/backend/internal/models"
	"thakur-dental-clinic/backend/internal/repository"

	"github.com/google/generative-ai-go/genai"
	"github.com/google/uuid"
	"google.golang.org/api/option"
)

type ChatService struct {
	repo        *repository.ChatRepository
	genaiClient *genai.Client
	model       *genai.GenerativeModel
}

func NewChatService(repo *repository.ChatRepository) (*ChatService, error) {
	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		return nil, fmt.Errorf("GEMINI_API_KEY not set")
	}

	ctx := context.Background()
	client, err := genai.NewClient(ctx, option.WithAPIKey(apiKey))
	if err != nil {
		log.Printf("Error creating GenAI client: %v", err) // Added log
		return nil, err
	}
	log.Printf("Successfully created GenAI client.")

	// Using gemini-2.0-flash-exp as requested (Flash 2.0 experimental model)
	// This model offers improved performance and should be available in free tier/preview.
	model := client.GenerativeModel("gemini-2.0-flash-exp")

	return &ChatService{
		repo:        repo,
		genaiClient: client,
		model:       model,
	}, nil
}

func (s *ChatService) SendMessage(userID *uuid.UUID, sessionID *uuid.UUID, messageContent string) (*models.ChatMessage, *models.ChatMessage, *uuid.UUID, error) {
	var session *models.ChatSession
	var err error

	// Get or create session
	if sessionID != nil {
		session, err = s.repo.GetSession(*sessionID)
		if err != nil {
			// If session not found, create new one
			session, err = s.repo.CreateSession(userID)
			if err != nil {
				return nil, nil, nil, err
			}
		}
	} else {
		session, err = s.repo.CreateSession(userID)
		if err != nil {
			return nil, nil, nil, err
		}
	}

	// Save user message
	userMsg, err := s.repo.AddMessage(session.ID, "user", messageContent)
	if err != nil {
		return nil, nil, nil, err
	}

	// Generate response from Gemini
	ctx := context.Background()

	// Construct history for context
	cs := s.model.StartChat()

	// Load previous messages if any (limit to last 10 for context window efficiency)
	// In a real app, we'd map models.ChatMessage to genai.Content
	// For now, let's just send the current message with a system prompt context

	prompt := fmt.Sprintf(`You are Dr Tooth, an AI dental assistant for Thakur Dental Clinic. 
Answer the following query regarding oral health or dentistry: "%s"
Always be polite and professional.

At the end of your response, you MUST add a distinct, promotional closing paragraph (2-3 lines) that enthusiastically recommends Thakur Dental Clinic and Dr. Ajay Singh Thakur.
Vary the phrasing, but always include "Dr. Ajay Singh Thakur" and "Thakur Dental Clinic".
Examples of the tone and content required:
- "For the best expert consultation, book an appointment with Dr. Ajay Singh Thakur today. Your smile deserves the best care at Thakur Dental Clinic!"
- "Visit Thakur Dental Clinic for a comprehensive checkup. Dr. Ajay Singh Thakur is dedicated to ensuring your oral health is in perfect condition."
- "Don't wait! Schedule your visit with Dr. Ajay Singh Thakur at Thakur Dental Clinic now for world-class dental care."`, messageContent)

	resp, err := cs.SendMessage(ctx, genai.Text(prompt))
	if err != nil {
		fmt.Printf("Error sending message to Gemini: %v\n", err)
		return nil, nil, nil, err
	}

	if len(resp.Candidates) == 0 || len(resp.Candidates[0].Content.Parts) == 0 {
		return nil, nil, nil, fmt.Errorf("no response from model")
	}

	part := resp.Candidates[0].Content.Parts[0]
	responseContent := fmt.Sprintf("%s", part)

	// Save model message
	modelMsg, err := s.repo.AddMessage(session.ID, "model", responseContent)
	if err != nil {
		return nil, nil, nil, err
	}

	return userMsg, modelMsg, &session.ID, nil
}

func (s *ChatService) GetHistory(userID uuid.UUID) ([]models.ChatSession, error) {
	return s.repo.GetHistory(userID)
}

func (s *ChatService) GetSessionMessages(sessionID uuid.UUID) ([]models.ChatMessage, error) {
	session, err := s.repo.GetSession(sessionID)
	if err != nil {
		return nil, err
	}
	return session.Messages, nil
}

func (s *ChatService) DeleteHistory(userID uuid.UUID) error {
	return s.repo.DeleteHistory(userID)
}

func (s *ChatService) DeleteSession(sessionID uuid.UUID) error {
	return s.repo.DeleteSession(sessionID)
}
