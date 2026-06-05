package services

import (
	"encoding/json"
	"errors"
	"fmt"
	"thakur-dental-clinic/backend/internal/models"
	"thakur-dental-clinic/backend/internal/repository"
	"time"

	"github.com/google/uuid"
)

var NotifyFunc func(userID string, payload string)


type AppointmentService struct {
	appointmentRepo *repository.AppointmentRepository
	userRepo        *repository.UserRepository
}

func NewAppointmentService(appointmentRepo *repository.AppointmentRepository, userRepo *repository.UserRepository) *AppointmentService {
	return &AppointmentService{
		appointmentRepo: appointmentRepo,
		userRepo:        userRepo,
	}
}

func (s *AppointmentService) CreateAppointment(patientID uuid.UUID, doctorID uuid.UUID, dateTime time.Time, notes string) (*models.Appointment, error) {
	// Verify patient exists and is active
	patient, err := s.userRepo.GetUserByID(patientID)
	if err != nil {
		return nil, errors.New("patient not found")
	}
	if !patient.IsActive {
		return nil, errors.New("patient account is inactive")
	}

	// Verify doctor exists and is active
	doctor, err := s.userRepo.GetUserByID(doctorID)
	if err != nil {
		return nil, errors.New("doctor not found")
	}
	if doctor.UserType != models.UserTypeDoctor {
		return nil, errors.New("selected user is not a doctor")
	}
	if !doctor.IsActive {
		return nil, errors.New("doctor is currently inactive")
	}
	if doctor.IsOnLeave {
		return nil, errors.New("doctor is currently on leave")
	}

	// 1. Restriction: One appointment per day
	hasExisting, err := s.appointmentRepo.HasPatientAppointmentToday(patientID)
	if err != nil {
		return nil, err
	}
	if hasExisting {
		return nil, errors.New("you already have an appointment scheduled for today")
	}

	// 2. Queue Logic
	lastApp, err := s.appointmentRepo.GetLastAppointmentForDay()
	if err != nil {
		return nil, err
	}

	queueNumber := 1
	estimatedStartTime := dateTime // Default to selected time if first in queue

	if lastApp != nil {
		queueNumber = lastApp.QueueNumber + 1
		// Estimated time is 35 mins after the last one's estimate
		estimatedStartTime = lastApp.EstimatedStartTime.Add(35 * time.Minute)
	}

	appointment := &models.Appointment{
		PatientID:          patientID,
		DoctorID:           doctorID,
		DateTime:           dateTime,
		Status:             models.AppointmentStatusScheduled,
		Notes:              notes,
		QueueNumber:        queueNumber,
		EstimatedStartTime: estimatedStartTime,
		PaymentStatus:      "pending",
	}

	if err := s.appointmentRepo.Create(appointment); err != nil {
		return nil, err
	}

	return appointment, nil
}

func (s *AppointmentService) UpdatePrescription(id uuid.UUID, prescriptionURLs string) (*models.Appointment, error) {
	appointment, err := s.appointmentRepo.GetByID(id)
	if err != nil {
		return nil, err
	}

	appointment.PrescriptionURLs = prescriptionURLs
	// Optionally mark as completed if prescription is added, or keep as is.
	// Typically prescription implies completion or post-visit.
	if appointment.Status == models.AppointmentStatusScheduled {
		appointment.Status = models.AppointmentStatusCompleted
	}

	if err := s.appointmentRepo.Update(appointment); err != nil {
		return nil, err
	}

	return appointment, nil
}

func (s *AppointmentService) ListUserAppointments(userID uuid.UUID, userType models.UserType) ([]models.Appointment, error) {
	if userType == models.UserTypePatient {
		return s.appointmentRepo.ListByPatient(userID)
	} else if userType == models.UserTypeDoctor {
		return s.appointmentRepo.ListByDoctor(userID)
	}
	// Receptionist/Admin can view all (not handled here specifically with this simplified logic, can expand)
	return s.appointmentRepo.ListAll()
}

func (s *AppointmentService) GetAppointment(id uuid.UUID) (*models.Appointment, error) {
	return s.appointmentRepo.GetByID(id)
}

func (s *AppointmentService) UpdateStatus(id uuid.UUID, status models.AppointmentStatus) (*models.Appointment, error) {
	appointment, err := s.appointmentRepo.GetByID(id)
	if err != nil {
		return nil, err
	}

	appointment.Status = status
	if err := s.appointmentRepo.Update(appointment); err != nil {
		return nil, err
	}

	return appointment, nil
}

func (s *AppointmentService) MarkArrived(id uuid.UUID) (*models.Appointment, error) {
	return s.UpdateStatus(id, "arrived")
}

func (s *AppointmentService) StartConsultation(id uuid.UUID) (*models.Appointment, error) {
	appointment, err := s.appointmentRepo.GetByID(id)
	if err != nil {
		return nil, err
	}

	now := time.Now()
	appointment.ActualStartTime = &now
	appointment.Status = "in-consultation"

	if err := s.appointmentRepo.Update(appointment); err != nil {
		return nil, err
	}

	return appointment, nil
}

func (s *AppointmentService) CompleteAppointment(id uuid.UUID, prescriptionURLs string, prescriptionType string, paymentMethod string, notes string) (*models.Appointment, error) {
	appointment, err := s.appointmentRepo.GetByID(id)
	if err != nil {
		return nil, err
	}

	now := time.Now()
	appointment.ActualEndTime = &now
	appointment.Status = models.AppointmentStatusCompleted
	appointment.PrescriptionURLs = prescriptionURLs
	appointment.PrescriptionType = prescriptionType
	appointment.PaymentStatus = "paid"
	appointment.PaymentMethod = paymentMethod
	appointment.Notes = notes

	if err := s.appointmentRepo.Update(appointment); err != nil {
		return nil, err
	}

	// Check if consultation exceeded the 35-minute slot duration
	slotDuration := 35 * time.Minute
	scheduledEndTime := appointment.EstimatedStartTime.Add(slotDuration)
	if now.After(scheduledEndTime) {
		excessMinutes := int(now.Sub(scheduledEndTime).Minutes())
		if excessMinutes > 0 {
			// Propagate shift to all subsequent appointments for this doctor
			_ = s.PropagateQueueShift(appointment.ID, excessMinutes)
		}
	}

	return appointment, nil
}

func (s *AppointmentService) PropagateQueueShift(appID uuid.UUID, delayMinutes int) error {
	app, err := s.appointmentRepo.GetByID(appID)
	if err != nil {
		return err
	}

	subs, err := s.appointmentRepo.GetSubsequentAppointmentsForDoctorToday(app.DoctorID, app.QueueNumber)
	if err != nil {
		return err
	}

	for _, sub := range subs {
		sub.EstimatedStartTime = sub.EstimatedStartTime.Add(time.Duration(delayMinutes) * time.Minute)
		sub.ShiftAccepted = false
		if err := s.appointmentRepo.Update(&sub); err != nil {
			continue
		}

		// Notify patient of shifted appointment
		payload, err := json.Marshal(map[string]interface{}{
			"type":                  "QUEUE_SHIFT",
			"appointmentId":         sub.ID.String(),
			"newEstimatedStartTime": sub.EstimatedStartTime.Format(time.RFC3339),
			"delayMinutes":          delayMinutes,
			"message":               fmt.Sprintf("Your appointment time has been shifted by %d minutes due to a delay.", delayMinutes),
		})
		if err == nil && NotifyFunc != nil {
			NotifyFunc(sub.PatientID.String(), string(payload))
		}
	}

	return nil
}

func (s *AppointmentService) ReassignDoctor(appID uuid.UUID, doctorID uuid.UUID) (*models.Appointment, error) {
	appointment, err := s.appointmentRepo.GetByID(appID)
	if err != nil {
		return nil, err
	}

	doctor, err := s.userRepo.GetUserByID(doctorID)
	if err != nil {
		return nil, errors.New("doctor not found")
	}
	if doctor.UserType != models.UserTypeDoctor {
		return nil, errors.New("selected user is not a doctor")
	}

	appointment.DoctorID = doctorID
	appointment.Doctor = models.User{} // clear preloaded association so GORM doesn't overwrite DoctorID on save
	if err := s.appointmentRepo.Update(appointment); err != nil {
		return nil, err
	}

	// Reload to get preloaded doctor details
	updatedApp, err := s.appointmentRepo.GetByID(appID)
	if err != nil {
		return appointment, nil
	}

	// Notify patient of doctor reassignment
	payload, err := json.Marshal(map[string]interface{}{
		"type":          "DOCTOR_REASSIGNED",
		"appointmentId": updatedApp.ID.String(),
		"message":       fmt.Sprintf("Your doctor has been changed to Dr. %s %s.", updatedApp.Doctor.FirstName, updatedApp.Doctor.LastName),
	})
	if err == nil && NotifyFunc != nil {
		NotifyFunc(updatedApp.PatientID.String(), string(payload))
	}

	return updatedApp, nil
}

func (s *AppointmentService) DelayAppointment(appID uuid.UUID, delayMinutes int) (*models.Appointment, error) {
	appointment, err := s.appointmentRepo.GetByID(appID)
	if err != nil {
		return nil, err
	}

	appointment.EstimatedStartTime = appointment.EstimatedStartTime.Add(time.Duration(delayMinutes) * time.Minute)
	appointment.ShiftAccepted = false

	if err := s.appointmentRepo.Update(appointment); err != nil {
		return nil, err
	}

	// Notify patient of manual delay
	payload, err := json.Marshal(map[string]interface{}{
		"type":                  "QUEUE_SHIFT",
		"appointmentId":         appointment.ID.String(),
		"newEstimatedStartTime": appointment.EstimatedStartTime.Format(time.RFC3339),
		"delayMinutes":          delayMinutes,
		"message":               fmt.Sprintf("Your appointment time has been shifted by %d minutes due to a delay.", delayMinutes),
	})
	if err == nil && NotifyFunc != nil {
		NotifyFunc(appointment.PatientID.String(), string(payload))
	}

	// Propagate shift to subsequent queue slots
	_ = s.PropagateQueueShift(appointment.ID, delayMinutes)

	return appointment, nil
}

func (s *AppointmentService) AcceptShift(appID uuid.UUID) (*models.Appointment, error) {
	appointment, err := s.appointmentRepo.GetByID(appID)
	if err != nil {
		return nil, err
	}

	appointment.ShiftAccepted = true
	if err := s.appointmentRepo.Update(appointment); err != nil {
		return nil, err
	}

	return appointment, nil
}

