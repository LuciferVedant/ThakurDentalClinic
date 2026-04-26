package handlers

import (
	"encoding/json"
	"net/http"
	"thakur-dental-clinic/backend/internal/models"
	"thakur-dental-clinic/backend/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type BlogHandler struct {
	blogService *services.BlogService
}

func NewBlogHandler(blogService *services.BlogService) *BlogHandler {
	return &BlogHandler{blogService: blogService}
}

// BlogPostResponse represents the response structure with parsed imageUrls
type BlogPostResponse struct {
	ID        uuid.UUID `json:"id"`
	Title     string    `json:"title"`
	Content   string    `json:"content"`
	ImageURL  string    `json:"imageUrl"`
	ImageURLs []string  `json:"imageUrls"`
	AuthorID  uuid.UUID `json:"authorId"`
	CreatedAt string    `json:"createdAt"`
	UpdatedAt string    `json:"updatedAt"`
	Author    *struct {
		FirstName string `json:"firstName"`
		LastName  string `json:"lastName"`
	} `json:"author,omitempty"`
}

func convertToResponse(post *models.BlogPost) BlogPostResponse {
	var imageUrls []string
	if post.ImageURLs != "" {
		json.Unmarshal([]byte(post.ImageURLs), &imageUrls)
	}

	// Fallback: if imageUrls is empty but we have a legacy imageUrl field
	if len(imageUrls) == 0 && post.ImageURLs != "" {
		imageUrls = []string{post.ImageURLs}
	}

	var author *struct {
		FirstName string `json:"firstName"`
		LastName  string `json:"lastName"`
	}
	if post.Author.ID != uuid.Nil {
		author = &struct {
			FirstName string `json:"firstName"`
			LastName  string `json:"lastName"`
		}{
			FirstName: post.Author.FirstName,
			LastName:  post.Author.LastName,
		}
	}

	return BlogPostResponse{
		ID:        post.ID,
		Title:     post.Title,
		Content:   post.Content,
		ImageURL:  "", // Legacy field, kept for compatibility
		ImageURLs: imageUrls,
		AuthorID:  post.AuthorID,
		CreatedAt: post.CreatedAt.Format("2006-01-02T15:04:05Z"),
		UpdatedAt: post.UpdatedAt.Format("2006-01-02T15:04:05Z"),
		Author:    author,
	}
}

func convertToResponseList(posts []models.BlogPost) []BlogPostResponse {
	responses := make([]BlogPostResponse, len(posts))
	for i, post := range posts {
		responses[i] = convertToResponse(&post)
	}
	return responses
}

func (h *BlogHandler) CreateBlogPost(c *gin.Context) {
	var req struct {
		Title     string   `json:"title" binding:"required"`
		Content   string   `json:"content" binding:"required"`
		ImageURLs []string `json:"imageUrls"` // Changed to array
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	// Marshal URLs to JSON
	urlsJson, err := json.Marshal(req.ImageURLs)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process image URLs"})
		return
	}

	post, err := h.blogService.CreateBlogPost(userID.(uuid.UUID), req.Title, req.Content, string(urlsJson))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, convertToResponse(post))
}

func (h *BlogHandler) GetAllBlogPosts(c *gin.Context) {
	posts, err := h.blogService.GetAllBlogPosts()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, convertToResponseList(posts))
}

func (h *BlogHandler) GetBlogPost(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	post, err := h.blogService.GetBlogPost(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "blog post not found"})
		return
	}

	c.JSON(http.StatusOK, convertToResponse(post))
}

func (h *BlogHandler) UpdateBlogPost(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	var req struct {
		Title     string   `json:"title" binding:"required"`
		Content   string   `json:"content" binding:"required"`
		ImageURLs []string `json:"imageUrls"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	// Marshal URLs to JSON
	urlsJson, err := json.Marshal(req.ImageURLs)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process image URLs"})
		return
	}

	post, err := h.blogService.UpdateBlogPost(id, userID.(uuid.UUID), req.Title, req.Content, string(urlsJson))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, convertToResponse(post))
}

func (h *BlogHandler) DeleteBlogPost(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	if err := h.blogService.DeleteBlogPost(id, userID.(uuid.UUID)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "blog post deleted"})
}
