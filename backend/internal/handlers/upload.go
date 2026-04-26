package handlers

import (
	"fmt"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type UploadHandler struct{}

func NewUploadHandler() *UploadHandler {
	return &UploadHandler{}
}

func (h *UploadHandler) UploadFile(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded"})
		return
	}

	// Validate file extension
	ext := strings.ToLower(filepath.Ext(file.Filename))
	if ext != ".jpg" && ext != ".jpeg" && ext != ".png" && ext != ".gif" && ext != ".pdf" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid file type. Only images and PDFs are allowed."})
		return
	}

	// Create unique filename
	filename := fmt.Sprintf("%d-%s%s", time.Now().UnixNano(), uuid.New().String(), ext)
	path := filepath.Join("uploads", filename)

	// Save file
	if err := c.SaveUploadedFile(file, path); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file"})
		return
	}

	// Return URL (assuming static file serving matches this)
	url := fmt.Sprintf("/uploads/%s", filename)
	c.JSON(http.StatusOK, gin.H{"url": url})
}

func (h *UploadHandler) UploadMultipleFiles(c *gin.Context) {
	// Multipart form
	form, err := c.MultipartForm()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to parse form"})
		return
	}

	files := form.File["files"]
	if len(files) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No files uploaded"})
		return
	}

	// Limit to 10 files max
	if len(files) > 10 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Maximum 10 files allowed"})
		return
	}

	var urls []string
	var errors []string

	for _, file := range files {
		// Validate file extension
		ext := strings.ToLower(filepath.Ext(file.Filename))
		if ext != ".jpg" && ext != ".jpeg" && ext != ".png" && ext != ".gif" && ext != ".webp" {
			errors = append(errors, fmt.Sprintf("Invalid file type for %s", file.Filename))
			continue
		}

		// Validate file size (max 5MB)
		if file.Size > 5*1024*1024 {
			errors = append(errors, fmt.Sprintf("File too large: %s (max 5MB)", file.Filename))
			continue
		}

		// Create unique filename
		filename := fmt.Sprintf("%d-%s%s", time.Now().UnixNano(), uuid.New().String(), ext)
		path := filepath.Join("uploads", filename)

		// Save file
		if err := c.SaveUploadedFile(file, path); err != nil {
			errors = append(errors, fmt.Sprintf("Failed to save %s", file.Filename))
			continue
		}

		// Return URL
		url := fmt.Sprintf("/uploads/%s", filename)
		urls = append(urls, url)
	}

	response := gin.H{
		"urls":  urls,
		"count": len(urls),
	}

	if len(errors) > 0 {
		response["errors"] = errors
	}

	c.JSON(http.StatusOK, response)
}
