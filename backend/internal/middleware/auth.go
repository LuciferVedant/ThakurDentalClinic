package middleware

import (
	"net/http"
	"strings"
	"thakur-dental-clinic/backend/internal/config"
	"thakur-dental-clinic/backend/internal/models"
	"thakur-dental-clinic/backend/internal/utils"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// AuthMiddleware validates JWT tokens
func AuthMiddleware(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header required"})
			c.Abort()
			return
		}

		// Extract token from "Bearer <token>"
		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid authorization header format"})
			c.Abort()
			return
		}

		token := parts[1]
		claims, err := utils.ValidateJWT(token, cfg.JWTSecret)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
			c.Abort()
			return
		}

		// Set user info in context
		c.Set("userID", claims.UserID)
		c.Set("email", claims.Email)
		c.Set("userType", claims.UserType)
		c.Set("isAdmin", claims.IsAdmin)

		c.Next()
	}
}

// OptionalAuthMiddleware attempts to validate JWT tokens but proceeds if missing or invalid
func OptionalAuthMiddleware(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.Next()
			return
		}

		// Extract token from "Bearer <token>"
		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.Next()
			return
		}

		token := parts[1]
		claims, err := utils.ValidateJWT(token, cfg.JWTSecret)
		if err == nil {
			// Set user info in context if valid
			c.Set("userID", claims.UserID)
			c.Set("email", claims.Email)
			c.Set("userType", claims.UserType)
			c.Set("isAdmin", claims.IsAdmin)
		}

		c.Next()
	}
}

// RequireAdmin middleware ensures the user is an admin doctor
func RequireAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		isAdmin, exists := c.Get("isAdmin")
		if !exists || !isAdmin.(bool) {
			c.JSON(http.StatusForbidden, gin.H{"error": "Admin access required"})
			c.Abort()
			return
		}

		userType, exists := c.Get("userType")
		if !exists || userType.(string) != string(models.UserTypeDoctor) {
			c.JSON(http.StatusForbidden, gin.H{"error": "Only admin doctors can perform this action"})
			c.Abort()
			return
		}

		c.Next()
	}
}

// RequireUserType middleware ensures the user has one of the allowed user types
func RequireUserType(allowedTypes ...models.UserType) gin.HandlerFunc {
	return func(c *gin.Context) {
		userType, exists := c.Get("userType")
		if !exists {
			c.JSON(http.StatusForbidden, gin.H{"error": "User type not found"})
			c.Abort()
			return
		}

		userTypeStr := userType.(string)
		for _, allowedType := range allowedTypes {
			if userTypeStr == string(allowedType) {
				c.Next()
				return
			}
		}

		c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
		c.Abort()
	}
}

// GetUserID helper to get user ID from context
func GetUserID(c *gin.Context) (uuid.UUID, bool) {
	userID, exists := c.Get("userID")
	if !exists {
		return uuid.Nil, false
	}
	return userID.(uuid.UUID), true
}

// GetIsAdmin helper to get admin status from context
func GetIsAdmin(c *gin.Context) bool {
	isAdmin, exists := c.Get("isAdmin")
	if !exists {
		return false
	}
	return isAdmin.(bool)
}
