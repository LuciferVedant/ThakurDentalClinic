package services_test

import (
	"encoding/json"
	"math"
	"testing"
	"thakur-dental-clinic/backend/internal/config"
	"thakur-dental-clinic/backend/internal/cron"
	"thakur-dental-clinic/backend/internal/models"
	"thakur-dental-clinic/backend/internal/repository"
	"thakur-dental-clinic/backend/internal/services"
	"thakur-dental-clinic/backend/internal/utils"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// SetupTestDB initializes a transaction-wrapped database connection for isolated tests.
func SetupTestDB(t *testing.T) (*gorm.DB, func()) {
	cfg := config.Load()
	// Force localhost if running locally
	if cfg.DBHost == "db" {
		cfg.DBHost = "localhost"
	}
	db, err := utils.InitDB(cfg)
	if err != nil {
		t.Fatalf("Failed to connect to test database: %v", err)
	}

	tx := db.Begin()
	cleanup := func() {
		tx.Rollback()
	}

	return tx, cleanup
}

func createTestUser(t *testing.T, db *gorm.DB, email, firstName, lastName string, userType models.UserType, isActive bool) *models.User {
	u := &models.User{
		ID:        uuid.New(),
		Email:     utils.StringPtr(email),
		FirstName: firstName,
		LastName:  lastName,
		UserType:  userType,
		IsActive:  isActive,
	}
	if err := db.Create(u).Error; err != nil {
		t.Fatalf("Failed to create test user: %v", err)
	}
	if !isActive {
		if err := db.Model(u).Update("is_active", false).Error; err != nil {
			t.Fatalf("Failed to deactivate test user: %v", err)
		}
	}
	return u
}

// TestAppointmentLifecycle_HappyPath verifies booking -> arrival -> consultation -> completion
func TestAppointmentLifecycle_HappyPath(t *testing.T) {
	db, cleanup := SetupTestDB(t)
	defer cleanup()

	userRepo := repository.NewUserRepository(db)
	appRepo := repository.NewAppointmentRepository(db)
	service := services.NewAppointmentService(appRepo, userRepo)

	// Create Doctor and Patient
	doc := createTestUser(t, db, "doc1@thakur.com", "Ajay", "Thakur", models.UserTypeDoctor, true)
	pat := createTestUser(t, db, "pat1@gmail.com", "Rohan", "Kumar", models.UserTypePatient, true)

	// 1. Book appointment (Patient)
	dateTime := time.Now().Add(1 * time.Hour)
	app, err := service.CreateAppointment(pat.ID, doc.ID, dateTime, "Routine cleanup")
	if err != nil {
		t.Fatalf("CreateAppointment failed: %v", err)
	}

	if app.QueueNumber != 1 {
		t.Errorf("Expected queue number 1, got %d", app.QueueNumber)
	}
	if app.Status != models.AppointmentStatusScheduled {
		t.Errorf("Expected status scheduled, got %s", app.Status)
	}
	if !app.ShiftAccepted {
		t.Errorf("Expected shift accepted to be true initially")
	}

	// Try booking another appointment today for the same patient (should fail)
	_, err = service.CreateAppointment(pat.ID, doc.ID, dateTime.Add(2*time.Hour), "Second appointment")
	if err == nil {
		t.Error("Expected error when booking second appointment on same day, but got nil")
	}

	// 2. Mark Arrived (Receptionist)
	app, err = service.MarkArrived(app.ID)
	if err != nil {
		t.Fatalf("MarkArrived failed: %v", err)
	}
	if app.Status != "arrived" {
		t.Errorf("Expected status arrived, got %s", app.Status)
	}

	// 3. Start Consultation (Receptionist/Doctor)
	app, err = service.StartConsultation(app.ID)
	if err != nil {
		t.Fatalf("StartConsultation failed: %v", err)
	}
	if app.Status != "in-consultation" {
		t.Errorf("Expected status in-consultation, got %s", app.Status)
	}
	if app.ActualStartTime == nil {
		t.Error("Expected ActualStartTime to be set, got nil")
	}

	// 4. Complete Visit (Doctor)
	app, err = service.CompleteAppointment(app.ID, `["/uploads/prescription1.jpg"]`, "manual", "cash", "Take medications twice daily")
	if err != nil {
		t.Fatalf("CompleteAppointment failed: %v", err)
	}
	if app.Status != models.AppointmentStatusCompleted {
		t.Errorf("Expected status completed, got %s", app.Status)
	}
	if app.PaymentStatus != "paid" {
		t.Errorf("Expected payment status paid, got %s", app.PaymentStatus)
	}
	if app.Notes != "Take medications daily" && app.Notes != "Take medications twice daily" { // supporting checking notes
		t.Errorf("Expected notes 'Take medications twice daily', got %s", app.Notes)
	}
	if app.ActualEndTime == nil {
		t.Error("Expected ActualEndTime to be set, got nil")
	}
}

// TestCreateAppointment_ValidationErrors verifies validation guards (doctor on leave, inactive doctor, invalid type, non-existent users)
func TestCreateAppointment_ValidationErrors(t *testing.T) {
	db, cleanup := SetupTestDB(t)
	defer cleanup()

	userRepo := repository.NewUserRepository(db)
	appRepo := repository.NewAppointmentRepository(db)
	service := services.NewAppointmentService(appRepo, userRepo)

	pat := createTestUser(t, db, "pat_err@gmail.com", "Patient", "Error", models.UserTypePatient, true)

	// Case 1: Booking with doctor on leave
	docOnLeave := createTestUser(t, db, "doc_leave@thakur.com", "On", "Leave", models.UserTypeDoctor, true)
	docOnLeave.IsOnLeave = true
	db.Save(docOnLeave)

	_, err := service.CreateAppointment(pat.ID, docOnLeave.ID, time.Now().Add(2*time.Hour), "Checkup")
	if err == nil || err.Error() != "doctor is currently on leave" {
		t.Errorf("Expected 'doctor is currently on leave' error, got: %v", err)
	}

	// Case 2: Booking with non-doctor type (e.g. receptionist)
	recep := createTestUser(t, db, "recep@thakur.com", "Receptionist", "Staff", models.UserTypeReceptionist, true)
	_, err = service.CreateAppointment(pat.ID, recep.ID, time.Now().Add(2*time.Hour), "Checkup")
	if err == nil || err.Error() != "selected user is not a doctor" {
		t.Errorf("Expected 'selected user is not a doctor' error, got: %v", err)
	}

	// Case 3: Booking with non-existent doctor ID
	fakeID := uuid.New()
	_, err = service.CreateAppointment(pat.ID, fakeID, time.Now().Add(2*time.Hour), "Checkup")
	if err == nil || err.Error() != "doctor not found" {
		t.Errorf("Expected 'doctor not found' error, got: %v", err)
	}

	// Case 4: Booking with non-existent patient ID
	fakePatientID := uuid.New()
	doc := createTestUser(t, db, "doc_ok@thakur.com", "Vijay", "Sharma", models.UserTypeDoctor, true)
	_, err = service.CreateAppointment(fakePatientID, doc.ID, time.Now().Add(2*time.Hour), "Checkup")
	if err == nil || err.Error() != "patient not found" {
		t.Errorf("Expected 'patient not found' error, got: %v", err)
	}

	// Case 5: Booking with inactive doctor
	inactiveDoc := createTestUser(t, db, "inactive_doc@thakur.com", "Inactive", "Doc", models.UserTypeDoctor, false)
	_, err = service.CreateAppointment(pat.ID, inactiveDoc.ID, time.Now().Add(2*time.Hour), "Checkup")
	if err == nil || err.Error() != "doctor is currently inactive" {
		t.Errorf("Expected 'doctor is currently inactive' error, got: %v", err)
	}

	// Case 6: Booking with inactive patient
	inactivePat := createTestUser(t, db, "inactive_pat@gmail.com", "Inactive", "Patient", models.UserTypePatient, false)
	_, err = service.CreateAppointment(inactivePat.ID, doc.ID, time.Now().Add(2*time.Hour), "Checkup")
	if err == nil || err.Error() != "patient account is inactive" {
		t.Errorf("Expected 'patient account is inactive' error, got: %v", err)
	}
}

// TestQueueShiftAndSSENotifications verifies over-consultation timing delays propagate down the queue with live alerts
func TestQueueShiftAndSSENotifications(t *testing.T) {
	db, cleanup := SetupTestDB(t)
	defer cleanup()

	userRepo := repository.NewUserRepository(db)
	appRepo := repository.NewAppointmentRepository(db)
	service := services.NewAppointmentService(appRepo, userRepo)

	// Intercept notifications
	var receivedNotifications []struct {
		UserID  string
		Payload string
	}
	services.NotifyFunc = func(userID string, payload string) {
		receivedNotifications = append(receivedNotifications, struct {
			UserID  string
			Payload string
		}{userID, payload})
	}
	defer func() { services.NotifyFunc = nil }()

	// Create Doctor and 3 Patients
	doc := createTestUser(t, db, "doc2@thakur.com", "Vijay", "Sharma", models.UserTypeDoctor, true)
	pat1 := createTestUser(t, db, "pat2_1@gmail.com", "Aman", "Gupta", models.UserTypePatient, true)
	pat2 := createTestUser(t, db, "pat2_2@gmail.com", "Neha", "Singh", models.UserTypePatient, true)
	pat3 := createTestUser(t, db, "pat2_3@gmail.com", "Sanjay", "Verma", models.UserTypePatient, true)

	// Book appointments sequentially (starts today)
	dateTime := time.Now().Add(10 * time.Minute)
	app1, err := service.CreateAppointment(pat1.ID, doc.ID, dateTime, "Checkup 1")
	if err != nil {
		t.Fatalf("Create pat1 failed: %v", err)
	}
	app2, err := service.CreateAppointment(pat2.ID, doc.ID, dateTime, "Checkup 2")
	if err != nil {
		t.Fatalf("Create pat2 failed: %v", err)
	}
	app3, err := service.CreateAppointment(pat3.ID, doc.ID, dateTime, "Checkup 3")
	if err != nil {
		t.Fatalf("Create pat3 failed: %v", err)
	}

	// Verify queue slots
	if app1.QueueNumber != 1 || app2.QueueNumber != 2 || app3.QueueNumber != 3 {
		t.Errorf("Expected queue numbers 1, 2, 3. Got %d, %d, %d", app1.QueueNumber, app2.QueueNumber, app3.QueueNumber)
	}

	// Verify starting times separated by 35 minutes
	expectedTime2 := app1.EstimatedStartTime.Add(35 * time.Minute)
	if !app2.EstimatedStartTime.Equal(expectedTime2) {
		t.Errorf("Expected pat2 time %s, got %s", expectedTime2, app2.EstimatedStartTime)
	}

	// Start consult for pat1
	app1, _ = service.StartConsultation(app1.ID)

	// Simulate completing pat1 late (duration = 50 minutes, exceeding 35 min slot by 15 mins)
	app1.EstimatedStartTime = time.Now().Add(-50 * time.Minute)
	db.Save(app1)

	// Clear captured notifications
	receivedNotifications = nil

	// Complete pat1 (exceeds default slot ending -> triggers ShiftPropagation)
	_, err = service.CompleteAppointment(app1.ID, `[]`, "digital", "online", "Clean teeth next time")
	if err != nil {
		t.Fatalf("CompleteAppointment failed: %v", err)
	}

	// Verify subsequent slots (pat2 and pat3) shifted
	var updatedApp2, updatedApp3 models.Appointment
	db.First(&updatedApp2, "id = ?", app2.ID)
	db.First(&updatedApp3, "id = ?", app3.ID)

	expectedShiftedTime2 := expectedTime2.Add(15 * time.Minute)
	diff := math.Abs(updatedApp2.EstimatedStartTime.Sub(expectedShiftedTime2).Seconds())
	if diff > 10 {
		t.Errorf("Expected shifted pat2 time %s, got %s", expectedShiftedTime2, updatedApp2.EstimatedStartTime)
	}
	if updatedApp2.ShiftAccepted {
		t.Error("Expected shiftAccepted to be false for pat2 after shift propagation")
	}

	// Verify SSE notification count and content
	if len(receivedNotifications) != 2 {
		t.Errorf("Expected 2 SSE alerts (for pat2 and pat3), got %d", len(receivedNotifications))
	}

	if receivedNotifications[0].UserID != pat2.ID.String() {
		t.Errorf("Expected notification to user %s, got %s", pat2.ID, receivedNotifications[0].UserID)
	}
	var payload map[string]interface{}
	json.Unmarshal([]byte(receivedNotifications[0].Payload), &payload)
	if payload["type"] != "QUEUE_SHIFT" {
		t.Errorf("Expected notification type QUEUE_SHIFT, got %s", payload["type"])
	}
}

// TestManualOverrideAndReassignment verifies manual delay switches and doctor reassignment triggers
func TestManualOverrideAndReassignment(t *testing.T) {
	db, cleanup := SetupTestDB(t)
	defer cleanup()

	userRepo := repository.NewUserRepository(db)
	appRepo := repository.NewAppointmentRepository(db)
	service := services.NewAppointmentService(appRepo, userRepo)

	// Intercept notifications
	var receivedNotifications []struct {
		UserID  string
		Payload string
	}
	services.NotifyFunc = func(userID string, payload string) {
		receivedNotifications = append(receivedNotifications, struct {
			UserID  string
			Payload string
		}{userID, payload})
	}
	defer func() { services.NotifyFunc = nil }()

	// Create Doctors & Patients
	doc1 := createTestUser(t, db, "doc3@thakur.com", "Ajay", "Thakur", models.UserTypeDoctor, true)
	doc2 := createTestUser(t, db, "doc4@thakur.com", "Vijay", "Sharma", models.UserTypeDoctor, true)
	pat := createTestUser(t, db, "pat3_1@gmail.com", "Rahul", "Verma", models.UserTypePatient, true)

	// Book appointment
	app, _ := service.CreateAppointment(pat.ID, doc1.ID, time.Now().Add(1*time.Hour), "Routine check")

	// 1. Manual delay timing override (+20 minutes) by Receptionist
	receivedNotifications = nil
	app, err := service.DelayAppointment(app.ID, 20)
	if err != nil {
		t.Fatalf("DelayAppointment failed: %v", err)
	}

	if app.ShiftAccepted {
		t.Error("Expected ShiftAccepted to become false for delayed patient")
	}

	// Verify SSE alert was sent to patient
	if len(receivedNotifications) != 1 {
		t.Errorf("Expected 1 notification for delay, got %d", len(receivedNotifications))
	}
	if receivedNotifications[0].UserID != pat.ID.String() {
		t.Errorf("Expected user ID %s, got %s", pat.ID, receivedNotifications[0].UserID)
	}

	// 2. Patient Accepts shifted time
	app, err = service.AcceptShift(app.ID)
	if err != nil {
		t.Fatalf("AcceptShift failed: %v", err)
	}
	if !app.ShiftAccepted {
		t.Error("Expected ShiftAccepted to be true after acceptance")
	}

	// 3. Admin Doctor Reassigns Doctor
	receivedNotifications = nil
	app, err = service.ReassignDoctor(app.ID, doc2.ID)
	if err != nil {
		t.Fatalf("ReassignDoctor failed: %v", err)
	}
	if app.DoctorID != doc2.ID {
		t.Errorf("Expected DoctorID %s, got %s", doc2.ID, app.DoctorID)
	}

	// Verify patient notification for reassignment
	if len(receivedNotifications) != 1 {
		t.Errorf("Expected 1 notification for reassignment, got %d", len(receivedNotifications))
	}
	var payload map[string]interface{}
	json.Unmarshal([]byte(receivedNotifications[0].Payload), &payload)
	if payload["type"] != "DOCTOR_REASSIGNED" {
		t.Errorf("Expected type DOCTOR_REASSIGNED, got %s", payload["type"])
	}
}

// TestPreArrivalRemindersCron verifies cron reminder polling updates states and notifications
func TestPreArrivalRemindersCron(t *testing.T) {
	db, cleanup := SetupTestDB(t)
	defer cleanup()

	// Intercept notifications
	var receivedNotifications []struct {
		UserID  string
		Payload string
	}
	services.NotifyFunc = func(userID string, payload string) {
		receivedNotifications = append(receivedNotifications, struct {
			UserID  string
			Payload string
		}{userID, payload})
	}
	defer func() { services.NotifyFunc = nil }()

	userRepo := repository.NewUserRepository(db)
	appRepo := repository.NewAppointmentRepository(db)
	service := services.NewAppointmentService(appRepo, userRepo)

	doc := createTestUser(t, db, "doc5@thakur.com", "Vijay", "Sharma", models.UserTypeDoctor, true)
	pat := createTestUser(t, db, "pat5@gmail.com", "Patient", "Five", models.UserTypePatient, true)

	// Create appointment starting in 15 minutes (under 30 minutes threshold)
	app, err := service.CreateAppointment(pat.ID, doc.ID, time.Now().Add(15*time.Minute), "Quick slot")
	if err != nil {
		t.Fatalf("CreateAppointment failed: %v", err)
	}

	// Trigger CheckReminders
	cron.CheckReminders(db)

	// Verify ReminderSent was updated in DB
	var updatedApp models.Appointment
	db.First(&updatedApp, "id = ?", app.ID)
	if !updatedApp.ReminderSent {
		t.Error("Expected ReminderSent to be true after running CheckReminders")
	}

	// Verify SSE reminder alert was sent
	if len(receivedNotifications) != 1 {
		t.Errorf("Expected 1 notification for reminder, got %d", len(receivedNotifications))
	}
	if receivedNotifications[0].UserID != pat.ID.String() {
		t.Errorf("Expected user ID %s, got %s", pat.ID, receivedNotifications[0].UserID)
	}
	var payload map[string]interface{}
	json.Unmarshal([]byte(receivedNotifications[0].Payload), &payload)
	if payload["type"] != "PRE_ARRIVAL_REMINDER" {
		t.Errorf("Expected type PRE_ARRIVAL_REMINDER, got %s", payload["type"])
	}
}
