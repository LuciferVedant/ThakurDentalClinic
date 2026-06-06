package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
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

// SplitFullGoogleName splits Google full name into first, middle, and last name
func SplitFullGoogleName(fullName, givenName, familyName string) (string, string, string) {
	parts := strings.Fields(strings.TrimSpace(fullName))
	if len(parts) >= 3 {
		firstName := parts[0]
		middleName := strings.Join(parts[1:len(parts)-1], " ")
		lastName := parts[len(parts)-1]
		return firstName, middleName, lastName
	} else if len(parts) == 2 {
		return parts[0], "", parts[1]
	} else if len(parts) == 1 {
		return parts[0], "", ""
	}
	return givenName, "", familyName
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
			firstName, middleName, lastName := SplitFullGoogleName(userInfo.Name, userInfo.GivenName, userInfo.FamilyName)
			user = &models.User{
				Email:      utils.StringPtr(userInfo.Email),
				FirstName:  firstName,
				MiddleName: middleName,
				LastName:   lastName,
				UserType:   models.UserTypePatient,
				IsActive:   true,
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
	var emailStr string
	if user.Email != nil {
		emailStr = *user.Email
	}
	jwtToken, err := utils.GenerateJWT(user.ID, emailStr, string(user.UserType), user.IsAdmin, s.cfg.JWTSecret)
	if err != nil {
		return nil, "", fmt.Errorf("failed to generate JWT: %w", err)
	}

	return user, jwtToken, nil
}

// RegisterPatient registers a new patient with email and/or phone
func (s *AuthService) RegisterPatient(email, password, firstName, middleName, lastName, phone string) (*models.User, string, error) {
	if email == "" && phone == "" {
		return nil, "", errors.New("at least one of email or phone number is required")
	}

	// Check if email already exists
	if email != "" {
		if _, err := s.userRepo.GetUserByEmail(email); err == nil {
			return nil, "", errors.New("this email is already registered, please login")
		}
	}

	// Check if phone already exists
	if phone != "" {
		if _, err := s.userRepo.GetUserByPhone(phone); err == nil {
			return nil, "", errors.New("this phone number is already registered, please login")
		}
	}

	// Hash password
	hashedPassword, err := utils.HashPassword(password)
	if err != nil {
		return nil, "", fmt.Errorf("failed to hash password: %w", err)
	}

	// Create user
	user := &models.User{
		Email:        utils.StringPtr(email),
		PasswordHash: &hashedPassword,
		FirstName:    firstName,
		MiddleName:   middleName,
		LastName:     lastName,
		Phone:        utils.StringPtr(phone),
		UserType:     models.UserTypePatient,
		IsActive:     true,
	}

	if err := s.userRepo.CreateUser(user); err != nil {
		return nil, "", fmt.Errorf("failed to create user: %w", err)
	}

	// Generate JWT
	var emailStr string
	if user.Email != nil {
		emailStr = *user.Email
	}
	jwtToken, err := utils.GenerateJWT(user.ID, emailStr, string(user.UserType), user.IsAdmin, s.cfg.JWTSecret)
	if err != nil {
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

// Login handles email/phone and password login
func (s *AuthService) Login(identifier, password string) (*models.User, string, error) {
	if identifier == "" {
		return nil, "", errors.New("email or phone number is required")
	}

	user, err := s.userRepo.GetUserByEmailOrPhone(identifier)
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
	var emailStr string
	if user.Email != nil {
		emailStr = *user.Email
	}
	jwtToken, err := utils.GenerateJWT(user.ID, emailStr, string(user.UserType), user.IsAdmin, s.cfg.JWTSecret)
	if err != nil {
		return nil, "", fmt.Errorf("failed to generate JWT: %w", err)
	}

	return user, jwtToken, nil
}

// CreateStaffUser creates a new doctor or receptionist (admin only)
func (s *AuthService) CreateStaffUser(adminID uuid.UUID, email, phone, firstName, middleName, lastName, password string, userType models.UserType, isAdmin bool) (*models.User, string, error) {
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

	if email == "" || phone == "" {
		return nil, "", errors.New("both email and phone number are required for staff members")
	}

	// Check if email already exists
	if _, err := s.userRepo.GetUserByEmail(email); err == nil {
		return nil, "", errors.New("email already exists")
	}

	// Check if phone already exists
	if _, err := s.userRepo.GetUserByPhone(phone); err == nil {
		return nil, "", errors.New("phone number already exists")
	}

	// Hash password
	hashedPassword, err := utils.HashPassword(password)
	if err != nil {
		return nil, "", err
	}

	// Create user
	user := &models.User{
		Email:        utils.StringPtr(email),
		PasswordHash: &hashedPassword,
		FirstName:    firstName,
		MiddleName:   middleName,
		LastName:     lastName,
		Phone:        utils.StringPtr(phone),
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
