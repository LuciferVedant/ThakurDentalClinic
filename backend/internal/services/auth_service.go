package services

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/smtp"
	"strings"
	"thakur-dental-clinic/backend/internal/config"
	"thakur-dental-clinic/backend/internal/models"
	"thakur-dental-clinic/backend/internal/repository"
	"thakur-dental-clinic/backend/internal/utils"
	"time"

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

// ForgotPassword initiates the password reset workflow
func (s *AuthService) ForgotPassword(identifier string) error {
	if identifier == "" {
		return errors.New("email or phone number is required")
	}

	user, err := s.userRepo.GetUserByEmailOrPhone(identifier)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("user not found")
		}
		return err
	}

	// Generate secure random token (32 bytes = 64 characters hex)
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return fmt.Errorf("failed to generate token: %w", err)
	}
	token := hex.EncodeToString(b)
	expiresAt := time.Now().Add(15 * time.Minute)

	user.PasswordResetToken = &token
	user.PasswordResetTokenExpiresAt = &expiresAt

	if err := s.userRepo.UpdateUser(user); err != nil {
		return fmt.Errorf("failed to save reset token: %w", err)
	}

	// Link format: http://localhost:5173/reset-password?token=XYZ
	resetLink := fmt.Sprintf("%s/reset-password?token=%s", s.cfg.FrontendURL, token)

	emailSent := false
	smsSent := false

	// Send to Email if available
	if user.Email != nil && *user.Email != "" {
		if err := s.sendResetEmail(*user.Email, resetLink); err != nil {
			// Log error but don't fail if we can fallback or if we just want to know
			fmt.Printf("SMTP Email sending failed: %v\n", err)
		} else {
			emailSent = true
		}
	}

	// Send to Phone if available
	if user.Phone != nil && *user.Phone != "" {
		if err := s.sendResetSMS(*user.Phone, resetLink); err != nil {
			fmt.Printf("SMS sending failed: %v\n", err)
		} else {
			smsSent = true
		}
	}

	if !emailSent && !smsSent {
		return errors.New("failed to send reset link via email and phone number")
	}

	return nil
}

// VerifyResetToken validates a password reset token
func (s *AuthService) VerifyResetToken(token string) error {
	if token == "" {
		return errors.New("token is required")
	}

	user, err := s.userRepo.GetUserByResetToken(token)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("invalid or expired password reset link")
		}
		return err
	}

	if user.PasswordResetTokenExpiresAt == nil || user.PasswordResetTokenExpiresAt.Before(time.Now()) {
		return errors.New("invalid or expired password reset link")
	}

	return nil
}

// ResetPassword completes the password reset workflow
func (s *AuthService) ResetPassword(token, newPassword string) error {
	if token == "" {
		return errors.New("token is required")
	}
	if len(newPassword) < 8 {
		return errors.New("password must be at least 8 characters")
	}

	user, err := s.userRepo.GetUserByResetToken(token)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("invalid or expired password reset link")
		}
		return err
	}

	if user.PasswordResetTokenExpiresAt == nil || user.PasswordResetTokenExpiresAt.Before(time.Now()) {
		return errors.New("invalid or expired password reset link")
	}

	// Hash new password
	hashedPassword, err := utils.HashPassword(newPassword)
	if err != nil {
		return err
	}

	user.PasswordHash = &hashedPassword
	// Disable/invalidate the token immediately after use
	user.PasswordResetToken = nil
	user.PasswordResetTokenExpiresAt = nil

	if err := s.userRepo.UpdateUser(user); err != nil {
		return fmt.Errorf("failed to reset password: %w", err)
	}

	return nil
}

func (s *AuthService) sendResetEmail(to, link string) error {
	// If SMTPHost is empty or set to localhost default without authentication config, we can print it to console/stdout in dev
	if s.cfg.SMTPHost == "" || s.cfg.SMTPHost == "localhost" || s.cfg.SMTPUsername == "" {
		fmt.Printf("[MOCK EMAIL SENT] To: %s, Link: %s\n", to, link)
		return nil
	}

	// Real SMTP Mail Send
	auth := smtp.PlainAuth("", s.cfg.SMTPUsername, s.cfg.SMTPPassword, s.cfg.SMTPHost)
	msg := []byte("To: " + to + "\r\n" +
		"Subject: Reset Your Password - Thakur Dental Clinic\r\n" +
		"Content-Type: text/html; charset=UTF-8\r\n\r\n" +
		"<html><body>" +
		"<h3>Thakur Dental Clinic</h3>" +
		"<p>You requested a password reset. Please click the link below to set a new password:</p>" +
		"<p><a href=\"" + link + "\">Reset Password Link</a></p>" +
		"<p>This link will expire in 15 minutes.</p>" +
		"<p>If you did not request this, please ignore this email.</p>" +
		"</body></html>")

	addr := fmt.Sprintf("%s:%s", s.cfg.SMTPHost, s.cfg.SMTPPort)
	return smtp.SendMail(addr, auth, s.cfg.SMTPFrom, []string{to}, msg)
}

func (s *AuthService) sendResetSMS(to, link string) error {
	// Implement mock sending as per SMS plan
	fmt.Printf("[MOCK SMS SENT] To: %s, Message: Hello! Use this link to reset your Thakur Dental Clinic password: %s. This link expires in 15 minutes.\n", to, link)
	return nil
}
