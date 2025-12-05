package repository

import (
	"thakur-dental-clinic/backend/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type UserRepository struct {
	db *gorm.DB
}

func NewUserRepository(db *gorm.DB) *UserRepository {
	return &UserRepository{db: db}
}

// CreateUser creates a new user
func (r *UserRepository) CreateUser(user *models.User) error {
	return r.db.Create(user).Error
}

// GetUserByID retrieves a user by ID
func (r *UserRepository) GetUserByID(id uuid.UUID) (*models.User, error) {
	var user models.User
	err := r.db.Preload("OAuthAccounts").First(&user, "id = ?", id).Error
	return &user, err
}

// GetUserByEmail retrieves a user by email
func (r *UserRepository) GetUserByEmail(email string) (*models.User, error) {
	var user models.User
	err := r.db.Preload("OAuthAccounts").First(&user, "email = ?", email).Error
	return &user, err
}

// GetUserByOAuthProvider retrieves a user by OAuth provider and provider user ID
func (r *UserRepository) GetUserByOAuthProvider(provider, providerUserID string) (*models.User, error) {
	var oauthAccount models.OAuthAccount
	if err := r.db.Preload("User").First(&oauthAccount, "provider = ? AND provider_user_id = ?", provider, providerUserID).Error; err != nil {
		return nil, err
	}
	return &oauthAccount.User, nil
}

// UpdateUser updates a user
func (r *UserRepository) UpdateUser(user *models.User) error {
	return r.db.Save(user).Error
}

// ListUsers retrieves all users with optional filters
func (r *UserRepository) ListUsers(userType *models.UserType, isActive *bool) ([]models.User, error) {
	var users []models.User
	query := r.db

	if userType != nil {
		query = query.Where("user_type = ?", *userType)
	}
	if isActive != nil {
		query = query.Where("is_active = ?", *isActive)
	}

	err := query.Find(&users).Error
	return users, err
}

// CreateOAuthAccount creates a new OAuth account
func (r *UserRepository) CreateOAuthAccount(oauthAccount *models.OAuthAccount) error {
	return r.db.Create(oauthAccount).Error
}

// UpdateOAuthAccount updates an OAuth account
func (r *UserRepository) UpdateOAuthAccount(oauthAccount *models.OAuthAccount) error {
	return r.db.Save(oauthAccount).Error
}

// GetOAuthAccount retrieves an OAuth account
func (r *UserRepository) GetOAuthAccount(provider, providerUserID string) (*models.OAuthAccount, error) {
	var oauthAccount models.OAuthAccount
	err := r.db.First(&oauthAccount, "provider = ? AND provider_user_id = ?", provider, providerUserID).Error
	return &oauthAccount, err
}
