package services_test

import (
	"testing"
	"thakur-dental-clinic/backend/internal/config"
	"thakur-dental-clinic/backend/internal/models"
	"thakur-dental-clinic/backend/internal/repository"
	"thakur-dental-clinic/backend/internal/services"
	"thakur-dental-clinic/backend/internal/utils"
	"time"

	"github.com/google/uuid"
)

func TestAuthService_PatientRegistrationAndLogin(t *testing.T) {
	db, cleanup := SetupTestDB(t)
	defer cleanup()

	cfg := config.Load()
	userRepo := repository.NewUserRepository(db)
	authService := services.NewAuthService(userRepo, cfg)

	// 1. Test Signup with Phone only
	patient1, token1, err := authService.RegisterPatient("", "password123", "Rohan", "", "Kumar", "9876543210")
	if err != nil {
		t.Fatalf("RegisterPatient (phone only) failed: %v", err)
	}
	if patient1.Phone == nil || *patient1.Phone != "9876543210" {
		t.Errorf("Expected phone '9876543210', got %v", patient1.Phone)
	}
	if patient1.Email != nil {
		t.Errorf("Expected email to be nil, got %v", *patient1.Email)
	}
	if token1 == "" {
		t.Error("Expected token to be generated")
	}

	// 2. Test Signup with Email only
	patient2, token2, err := authService.RegisterPatient("pat2@gmail.com", "password123", "Shyam", "", "Lal", "")
	if err != nil {
		t.Fatalf("RegisterPatient (email only) failed: %v", err)
	}
	if patient2.Email == nil || *patient2.Email != "pat2@gmail.com" {
		t.Errorf("Expected email 'pat2@gmail.com', got %v", patient2.Email)
	}
	if patient2.Phone != nil {
		t.Errorf("Expected phone to be nil, got %v", *patient2.Phone)
	}
	if token2 == "" {
		t.Error("Expected token to be generated")
	}

	// 3. Test Signup fails if both Email and Phone are empty
	_, _, err = authService.RegisterPatient("", "password123", "Fail", "", "User", "")
	if err == nil {
		t.Error("Expected signup to fail when both email and phone are empty")
	}

	// 4. Test Signup fails if email already exists
	_, _, err = authService.RegisterPatient("pat2@gmail.com", "password123", "Dup", "", "User", "")
	if err == nil || err.Error() != "this email is already registered, please login" {
		t.Errorf("Expected duplicate email error, got: %v", err)
	}

	// 5. Test Signup fails if phone already exists
	_, _, err = authService.RegisterPatient("", "password123", "Dup", "", "User", "9876543210")
	if err == nil || err.Error() != "this phone number is already registered, please login" {
		t.Errorf("Expected duplicate phone error, got: %v", err)
	}

	// 6. Test Login with Phone number
	loggedIn1, _, err := authService.Login("9876543210", "password123")
	if err != nil {
		t.Fatalf("Login via phone failed: %v", err)
	}
	if loggedIn1.ID != patient1.ID {
		t.Errorf("Expected user ID %s, got %s", patient1.ID, loggedIn1.ID)
	}

	// 7. Test Login with Email
	loggedIn2, _, err := authService.Login("pat2@gmail.com", "password123")
	if err != nil {
		t.Fatalf("Login via email failed: %v", err)
	}
	if loggedIn2.ID != patient2.ID {
		t.Errorf("Expected user ID %s, got %s", patient2.ID, loggedIn2.ID)
	}

	// 8. Test Login fails with invalid password
	_, _, err = authService.Login("9876543210", "wrongpassword")
	if err == nil || err.Error() != "invalid credentials" {
		t.Errorf("Expected invalid credentials error, got %v", err)
	}
}

func TestAuthService_StaffRegistrationRequiredCredentials(t *testing.T) {
	db, cleanup := SetupTestDB(t)
	defer cleanup()

	cfg := config.Load()
	userRepo := repository.NewUserRepository(db)
	authService := services.NewAuthService(userRepo, cfg)

	// Create an Admin Doctor manually
	adminEmail := "admin1@thakur.com"
	hashedPassword, _ := utils.HashPassword("adminpassword")
	admin := &models.User{
		ID:           uuid.New(),
		Email:        &adminEmail,
		PasswordHash: &hashedPassword,
		FirstName:    "Admin",
		LastName:     "Doctor",
		UserType:     models.UserTypeDoctor,
		IsAdmin:      true,
		IsActive:     true,
	}
	if err := userRepo.CreateUser(admin); err != nil {
		t.Fatalf("Failed to create admin user: %v", err)
	}

	// 1. Staff creation fails if Phone is empty
	_, _, err := authService.CreateStaffUser(admin.ID, "staff1@thakur.com", "", "Amit", "", "Sharma", "password123", models.UserTypeDoctor, false)
	if err == nil || err.Error() != "both email and phone number are required for staff members" {
		t.Errorf("Expected error for empty phone, got: %v", err)
	}

	// 2. Staff creation fails if Email is empty
	_, _, err = authService.CreateStaffUser(admin.ID, "", "9999999999", "Amit", "", "Sharma", "password123", models.UserTypeDoctor, false)
	if err == nil || err.Error() != "both email and phone number are required for staff members" {
		t.Errorf("Expected error for empty email, got: %v", err)
	}

	// 3. Staff creation succeeds with both email and phone number
	staff, tempPass, err := authService.CreateStaffUser(admin.ID, "staff1@thakur.com", "9999999999", "Amit", "", "Sharma", "password123", models.UserTypeDoctor, false)
	if err != nil {
		t.Fatalf("CreateStaffUser failed: %v", err)
	}
	if staff.Email == nil || *staff.Email != "staff1@thakur.com" {
		t.Errorf("Expected email 'staff1@thakur.com', got %v", staff.Email)
	}
	if staff.Phone == nil || *staff.Phone != "9999999999" {
		t.Errorf("Expected phone '9999999999', got %v", staff.Phone)
	}
	if tempPass != "password123" {
		t.Errorf("Expected temp password, got %s", tempPass)
	}
}

func TestAuthService_ForgotPasswordFlow(t *testing.T) {
	db, cleanup := SetupTestDB(t)
	defer cleanup()

	cfg := config.Load()
	userRepo := repository.NewUserRepository(db)
	authService := services.NewAuthService(userRepo, cfg)

	// Create a test patient with email and phone
	patient, _, err := authService.RegisterPatient("reset@thakur.com", "password123", "Reset", "", "User", "8888888888")
	if err != nil {
		t.Fatalf("Failed to create test patient: %v", err)
	}

	// 1. ForgotPassword fails with invalid user
	err = authService.ForgotPassword("nonexistent@thakur.com")
	if err == nil || err.Error() != "user not found" {
		t.Errorf("Expected 'user not found' error, got: %v", err)
	}

	// 2. ForgotPassword succeeds for valid email/phone
	err = authService.ForgotPassword("reset@thakur.com")
	if err != nil {
		t.Fatalf("ForgotPassword failed: %v", err)
	}

	// Fetch patient to get the generated token
	patient, err = userRepo.GetUserByID(patient.ID)
	if err != nil {
		t.Fatalf("Failed to fetch user from DB: %v", err)
	}
	if patient.PasswordResetToken == nil || *patient.PasswordResetToken == "" {
		t.Fatal("Expected reset token to be generated and saved")
	}
	if patient.PasswordResetTokenExpiresAt == nil || patient.PasswordResetTokenExpiresAt.Before(time.Now()) {
		t.Fatal("Expected valid reset token expiry time")
	}

	token := *patient.PasswordResetToken

	// 2.5 Test Expired Token Scenario
	expiredTime := time.Now().Add(-1 * time.Hour)
	patient.PasswordResetTokenExpiresAt = &expiredTime
	if err := userRepo.UpdateUser(patient); err != nil {
		t.Fatalf("Failed to update user to expired token: %v", err)
	}
	err = authService.VerifyResetToken(token)
	if err == nil || err.Error() != "invalid or expired password reset link" {
		t.Errorf("Expected expired token verify to fail, got: %v", err)
	}
	err = authService.ResetPassword(token, "anotherpassword123")
	if err == nil || err.Error() != "invalid or expired password reset link" {
		t.Errorf("Expected expired token reset to fail, got: %v", err)
	}

	// Regenerate a fresh unexpired token for the remaining test steps
	err = authService.ForgotPassword("reset@thakur.com")
	if err != nil {
		t.Fatalf("ForgotPassword failed: %v", err)
	}
	patient, err = userRepo.GetUserByID(patient.ID)
	if err != nil {
		t.Fatalf("Failed to fetch user from DB: %v", err)
	}
	token = *patient.PasswordResetToken

	// 3. VerifyResetToken fails for invalid token
	err = authService.VerifyResetToken("invalidtoken")
	if err == nil || err.Error() != "invalid or expired password reset link" {
		t.Errorf("Expected verify error for invalid token, got: %v", err)
	}

	// 4. VerifyResetToken succeeds for valid token
	err = authService.VerifyResetToken(token)
	if err != nil {
		t.Errorf("VerifyResetToken failed: %v", err)
	}

	// 5. ResetPassword fails for invalid token
	err = authService.ResetPassword("invalidtoken", "newpassword123")
	if err == nil || err.Error() != "invalid or expired password reset link" {
		t.Errorf("Expected reset error for invalid token, got: %v", err)
	}

	// 6. ResetPassword succeeds for valid token
	err = authService.ResetPassword(token, "newpassword123")
	if err != nil {
		t.Fatalf("ResetPassword failed: %v", err)
	}

	// Fetch patient and verify token is cleared (single-use)
	patient, err = userRepo.GetUserByID(patient.ID)
	if err != nil {
		t.Fatalf("Failed to fetch user after reset: %v", err)
	}
	if patient.PasswordResetToken != nil {
		t.Errorf("Expected reset token to be cleared (nil), got %v", *patient.PasswordResetToken)
	}
	if patient.PasswordResetTokenExpiresAt != nil {
		t.Error("Expected reset token expiry to be cleared")
	}

	// 7. VerifyResetToken fails now because token was cleared
	err = authService.VerifyResetToken(token)
	if err == nil || err.Error() != "invalid or expired password reset link" {
		t.Errorf("Expected token to be disabled after use, got: %v", err)
	}

	// 8. Test Login with old credentials fails
	_, _, err = authService.Login("reset@thakur.com", "password123")
	if err == nil || err.Error() != "invalid credentials" {
		t.Errorf("Expected login with old password to fail, got: %v", err)
	}

	// 9. Test Login with new credentials succeeds
	user, jwtToken, err := authService.Login("reset@thakur.com", "newpassword123")
	if err != nil {
		t.Fatalf("Login with new password failed: %v", err)
	}
	if user.ID != patient.ID {
		t.Errorf("Expected user ID %s, got %s", patient.ID, user.ID)
	}
	if jwtToken == "" {
		t.Error("Expected valid JWT token on login")
	}
}
