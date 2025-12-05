package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"thakur-dental-clinic/backend/internal/config"
	"thakur-dental-clinic/backend/internal/models"
	"thakur-dental-clinic/backend/internal/repository"
	"thakur-dental-clinic/backend/internal/utils"

	"github.com/google/uuid"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"gorm.io/gorm"
)

type AuthService struct {
	userRepo     *repository.UserRepository
	cfg          *config.Config
	googleConfig *oauth2.Config
}

func NewAuthService(userRepo *repository.UserRepository, cfg *config.Config) *AuthService {
	googleConfig := &oauth2.Config{
		ClientID:     cfg.GoogleClientID,
		ClientSecret: cfg.GoogleClientSecret,
		RedirectURL:  cfg.GoogleRedirectURL,
		Scopes: []string{
			"https://www.googleapis.com/auth/userinfo.email",
			"https://www.googleapis.com/auth/userinfo.profile",
		},
		Endpoint: google.Endpoint,
	}

	return &AuthService{
		userRepo:     userRepo,
		cfg:          cfg,
		googleConfig: googleConfig,
	}
}

// GoogleUserInfo represents user info from Google
type GoogleUserInfo struct {
	ID            string `json:"id"`
	Email         string `json:"email"`
	VerifiedEmail bool   `json:"verified_email"`
	Name          string `json:"name"`
	GivenName     string `json:"given_name"`
	FamilyName    string `json:"family_name"`
	Picture       string `json:"picture"`
}

// GetGoogleAuthURL returns the Google OAuth authorization URL
func (s *AuthService) GetGoogleAuthURL(state string) string {
	return s.googleConfig.AuthCodeURL(state)
}

// HandleGoogleCallback handles the Google OAuth callback
func (s *AuthService) HandleGoogleCallback(code string) (*models.User, string, error) {
	// Exchange code for token
	// For popup flow (used by frontend), redirect_uri must be "postmessage"
	token, err := s.googleConfig.Exchange(context.Background(), code, oauth2.SetAuthURLParam("redirect_uri", "postmessage"))
	if err != nil {
		fmt.Printf("Google Exchange Error: %v\n", err)
		fmt.Printf("Code received: %s\n", code)
		return nil, "", fmt.Errorf("failed to exchange token: %w", err)
	}
	fmt.Printf("Successfully exchanged token. Access Token: %s...\n", token.AccessToken[:10])

	// Get user info from Google
	userInfo, err := s.getGoogleUserInfo(token.AccessToken)
	if err != nil {
		return nil, "", fmt.Errorf("failed to get user info: %w", err)
	}

	// Check if user exists by OAuth provider
	user, err := s.userRepo.GetUserByOAuthProvider("google", userInfo.ID)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, "", fmt.Errorf("failed to get user: %w", err)
	}

	if errors.Is(err, gorm.ErrRecordNotFound) {
		// Check if user exists by email (for linking accounts)
		existingUser, err := s.userRepo.GetUserByEmail(userInfo.Email)
		if err == nil {
			// User exists, link OAuth account
			user = existingUser
		} else if errors.Is(err, gorm.ErrRecordNotFound) {
			// User doesn't exist, create new patient account
			user = &models.User{
				Email:     userInfo.Email,
				FirstName: userInfo.GivenName,
				LastName:  userInfo.FamilyName,
				UserType:  models.UserTypePatient,
				IsActive:  true,
			}

			if err := s.userRepo.CreateUser(user); err != nil {
				return nil, "", fmt.Errorf("failed to create user: %w", err)
			}
		} else {
			return nil, "", fmt.Errorf("failed to check existing user: %w", err)
		}

		// Create OAuth account
		oauthAccount := &models.OAuthAccount{
			UserID:         user.ID,
			Provider:       "google",
			ProviderUserID: userInfo.ID,
			AccessToken:    token.AccessToken,
			RefreshToken:   token.RefreshToken,
		}

		if err := s.userRepo.CreateOAuthAccount(oauthAccount); err != nil {
			return nil, "", fmt.Errorf("failed to create OAuth account: %w", err)
		}
	} else {
		// Update OAuth tokens
		oauthAccount, err := s.userRepo.GetOAuthAccount("google", userInfo.ID)
		if err == nil {
			oauthAccount.AccessToken = token.AccessToken
			oauthAccount.RefreshToken = token.RefreshToken
			s.userRepo.UpdateOAuthAccount(oauthAccount)
		}
	}

	// Generate JWT
	jwtToken, err := utils.GenerateJWT(user.ID, user.Email, string(user.UserType), user.IsAdmin, s.cfg.JWTSecret)
	if err != nil {
		return nil, "", fmt.Errorf("failed to generate JWT: %w", err)
	}

	return user, jwtToken, nil
}

// RegisterPatient registers a new patient with email and password
func (s *AuthService) RegisterPatient(email, password, firstName, lastName, phone string) (*models.User, string, error) {
	// Check if email already exists
	if _, err := s.userRepo.GetUserByEmail(email); err == nil {
		return nil, "", errors.New("email already exists")
	}

	// Hash password
	hashedPassword, err := utils.HashPassword(password)
	if err != nil {
		return nil, "", fmt.Errorf("failed to hash password: %w", err)
	}

	// Create user
	user := &models.User{
		Email:        email,
		PasswordHash: &hashedPassword,
		FirstName:    firstName,
		LastName:     lastName,
		Phone:        phone,
		UserType:     models.UserTypePatient,
		IsActive:     true,
	}

	if err := s.userRepo.CreateUser(user); err != nil {
		return nil, "", fmt.Errorf("failed to create user: %w", err)
	}

	// Generate JWT
	jwtToken, err := utils.GenerateJWT(user.ID, user.Email, string(user.UserType), user.IsAdmin, s.cfg.JWTSecret)
	if err != nil {
		// If JWT generation fails, we should probably delete the user or handle it.
		// For now, logging the error and returning it is better than a generic 400.
		// Ideally, we would use a transaction, but that requires refactoring repository to accept tx.
		return nil, "", fmt.Errorf("user created but failed to generate token: %w", err)
	}

	return user, jwtToken, nil
}

// getGoogleUserInfo fetches user info from Google
func (s *AuthService) getGoogleUserInfo(accessToken string) (*GoogleUserInfo, error) {
	resp, err := http.Get("https://www.googleapis.com/oauth2/v2/userinfo?access_token=" + accessToken)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to get user info: status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var userInfo GoogleUserInfo
	if err := json.Unmarshal(body, &userInfo); err != nil {
		return nil, err
	}

	return &userInfo, nil
}

// Login handles email/password login
func (s *AuthService) Login(email, password string) (*models.User, string, error) {
	user, err := s.userRepo.GetUserByEmail(email)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, "", errors.New("invalid credentials")
		}
		return nil, "", err
	}

	if !user.IsActive {
		return nil, "", errors.New("account is inactive")
	}

	if user.PasswordHash == nil {
		return nil, "", errors.New("password not set for this account")
	}

	if !utils.CheckPasswordHash(password, *user.PasswordHash) {
		return nil, "", errors.New("invalid credentials")
	}

	// Generate JWT
	jwtToken, err := utils.GenerateJWT(user.ID, user.Email, string(user.UserType), user.IsAdmin, s.cfg.JWTSecret)
	if err != nil {
		return nil, "", fmt.Errorf("failed to generate JWT: %w", err)
	}

	return user, jwtToken, nil
}

// CreateStaffUser creates a new doctor or receptionist (admin only)
func (s *AuthService) CreateStaffUser(adminID uuid.UUID, email, firstName, lastName, password string, userType models.UserType, isAdmin bool) (*models.User, string, error) {
	// Verify admin
	admin, err := s.userRepo.GetUserByID(adminID)
	if err != nil {
		return nil, "", errors.New("admin not found")
	}

	if !admin.IsAdmin || admin.UserType != models.UserTypeDoctor {
		return nil, "", errors.New("only admin doctors can create staff accounts")
	}

	if userType != models.UserTypeDoctor && userType != models.UserTypeReceptionist {
		return nil, "", errors.New("invalid user type")
	}

	// Check if email already exists
	if _, err := s.userRepo.GetUserByEmail(email); err == nil {
		return nil, "", errors.New("email already exists")
	}

	// Hash password
	hashedPassword, err := utils.HashPassword(password)
	if err != nil {
		return nil, "", err
	}

	// Create user
	user := &models.User{
		Email:        email,
		PasswordHash: &hashedPassword,
		FirstName:    firstName,
		LastName:     lastName,
		UserType:     userType,
		IsAdmin:      isAdmin,
		IsActive:     true,
		CreatedBy:    &adminID,
	}

	if err := s.userRepo.CreateUser(user); err != nil {
		return nil, "", err
	}

	return user, password, nil
}
