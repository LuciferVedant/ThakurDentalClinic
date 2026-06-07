package handlers

import (
	"net/http"
	"thakur-dental-clinic/backend/internal/middleware"
	"thakur-dental-clinic/backend/internal/models"
	"thakur-dental-clinic/backend/internal/repository"
	"thakur-dental-clinic/backend/internal/services"
	"thakur-dental-clinic/backend/internal/utils"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type UserHandler struct {
	userRepo    *repository.UserRepository
	authService *services.AuthService
}

func NewUserHandler(userRepo *repository.UserRepository, authService *services.AuthService) *UserHandler {
	return &UserHandler{
		userRepo:    userRepo,
		authService: authService,
	}
}

// CreateStaffRequest represents the request to create a staff member
type CreateStaffRequest struct {
	Email      string `json:"email" binding:"required,email"`
	Phone      string `json:"phone" binding:"required"`
	FirstName  string `json:"firstName" binding:"required"`
	MiddleName string `json:"middleName"`
	LastName   string `json:"lastName" binding:"required"`
	Password   string `json:"password" binding:"required,min=8"`
	UserType   string `json:"userType" binding:"required,oneof=doctor receptionist"`
	IsAdmin    bool   `json:"isAdmin"`
}

// CreateStaff creates a new doctor or receptionist
func (h *UserHandler) CreateStaff(c *gin.Context) {
	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var req CreateStaffRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userType := models.UserType(req.UserType)
	user, tempPassword, err := h.authService.CreateStaffUser(
		userID,
		req.Email,
		req.Phone,
		req.FirstName,
		req.MiddleName,
		req.LastName,
		req.Password,
		userType,
		req.IsAdmin,
	)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"user": user,
		"credentials": gin.H{
			"email":    user.Email,
			"password": tempPassword,
		},
		"message": "Staff account created successfully. Please share these credentials securely.",
	})
}

// ListUsers returns a list of users
func (h *UserHandler) ListUsers(c *gin.Context) {
	// Check if requester is Admin
	isAdminVal, existsAdmin := c.Get("isAdmin")
	isAdmin := existsAdmin && isAdminVal.(bool)

	var userType *models.UserType
	var isActive *bool

	if userTypeStr := c.Query("userType"); userTypeStr != "" {
		ut := models.UserType(userTypeStr)
		userType = &ut
	}

	if isActiveStr := c.Query("isActive"); isActiveStr != "" {
		active := isActiveStr == "true"
		isActive = &active
	}

	// Security Constraint: Non-admin users are ONLY allowed to list active doctors.
	if !isAdmin {
		if userType == nil || *userType != models.UserTypeDoctor {
			c.JSON(http.StatusForbidden, gin.H{"error": "Non-admin users can only list doctor profiles"})
			return
		}
		// Force active doctors only for non-admins to prevent listing inactive ones
		active := true
		isActive = &active
	}

	users, err := h.userRepo.ListUsers(userType, isActive)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch users"})
		return
	}

	// For security, remove password hashes and other sensitive fields for non-admins
	if !isAdmin {
		for i := range users {
			users[i].PasswordHash = nil
			users[i].PasswordResetToken = nil
			users[i].PasswordResetTokenExpiresAt = nil
		}
	}

	c.JSON(http.StatusOK, gin.H{"users": users})
}

// GetUser returns a specific user by ID
func (h *UserHandler) GetUser(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	user, err := h.userRepo.GetUserByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"user": user})
}

// UpdateUserRequest represents the request to update a user
type UpdateUserRequest struct {
	FirstName      *string `json:"firstName"`
	MiddleName     *string `json:"middleName"`
	LastName       *string `json:"lastName"`
	Age            *int    `json:"age"`
	Gender         *string `json:"gender"`
	Address        *string `json:"address"`
	ProfilePicture *string `json:"profilePicture"`
	Phone          *string `json:"phone"`
	Email          *string `json:"email"`
	IsActive       *bool   `json:"isActive"`
}

// UpdateUser updates a user's information
func (h *UserHandler) UpdateUser(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	// Authorization check
	currentUserID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}
	isAdmin := middleware.GetIsAdmin(c)

	// DEBUG LOG
	// log.Printf("UpdateUser Debug: CurrentUserID=%v, TargetID=%v, IsAdmin=%v", currentUserID, id, isAdmin)

	if !isAdmin && currentUserID != id {
		c.JSON(http.StatusForbidden, gin.H{"error": "You can only update your own profile"})
		return
	}

	var req UpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := h.userRepo.GetUserByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// Update fields if provided
	if req.FirstName != nil {
		user.FirstName = *req.FirstName
	}
	if req.MiddleName != nil {
		user.MiddleName = *req.MiddleName
	}
	if req.LastName != nil {
		user.LastName = *req.LastName
	}
	if req.Age != nil {
		user.Age = *req.Age
	}
	if req.Gender != nil {
		user.Gender = *req.Gender
	}
	if req.Address != nil {
		user.Address = *req.Address
	}
	if req.ProfilePicture != nil {
		user.ProfilePicture = *req.ProfilePicture
	}
	
	// Validate email and phone update logic
	if req.Email != nil {
		emailVal := *req.Email
		if emailVal == "" && (req.Phone != nil && *req.Phone == "" || req.Phone == nil && (user.Phone == nil || *user.Phone == "")) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "At least one of email or phone number is required"})
			return
		}
		
		if user.UserType != models.UserTypePatient && emailVal == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Email is required for staff members"})
			return
		}
		
		if emailVal != "" {
			if !utils.IsValidEmail(emailVal) {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid email format"})
				return
			}
			// Check uniqueness of new email
			if existing, err := h.userRepo.GetUserByEmail(emailVal); err == nil && existing.ID != user.ID {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Email is already in use"})
				return
			}
			user.Email = &emailVal
		} else {
			user.Email = nil
		}
	}
	
	if req.Phone != nil {
		phoneVal := *req.Phone
		if phoneVal == "" && (req.Email != nil && *req.Email == "" || req.Email == nil && (user.Email == nil || *user.Email == "")) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "At least one of email or phone number is required"})
			return
		}
		
		if user.UserType != models.UserTypePatient && phoneVal == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Phone number is required for staff members"})
			return
		}
		
		if phoneVal != "" {
			// Check uniqueness of new phone number
			if existing, err := h.userRepo.GetUserByPhone(phoneVal); err == nil && existing.ID != user.ID {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Phone number is already in use"})
				return
			}
			user.Phone = &phoneVal
		} else {
			user.Phone = nil
		}
	}
	
	if req.IsActive != nil {
		user.IsActive = *req.IsActive
	}

	if err := h.userRepo.UpdateUser(user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"user": user})
}

// DeactivateUser deactivates a user account
func (h *UserHandler) DeactivateUser(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	user, err := h.userRepo.GetUserByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	user.IsActive = false
	if err := h.userRepo.UpdateUser(user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to deactivate user"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "User deactivated successfully"})
}
