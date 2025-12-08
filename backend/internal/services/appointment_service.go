package services

import (
	"errors"
	"thakur-dental-clinic/backend/internal/models"
	"thakur-dental-clinic/backend/internal/repository"
	"time"

	"github.com/google/uuid"
)

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
	// Verify patient exists
	_, err := s.userRepo.GetUserByID(patientID)
	if err != nil {
		return nil, errors.New("patient not found")
	}

	// Verify doctor exists
	_, err = s.userRepo.GetUserByID(doctorID)
	if err != nil {
		return nil, errors.New("doctor not found")
	}

	appointment := &models.Appointment{
		PatientID: patientID,
		DoctorID:  doctorID,
		DateTime:  dateTime,
		Status:    models.AppointmentStatusScheduled,
		Notes:     notes,
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
