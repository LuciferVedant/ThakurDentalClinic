package repository

import (
	"thakur-dental-clinic/backend/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type AppointmentRepository struct {
	db *gorm.DB
}

func NewAppointmentRepository(db *gorm.DB) *AppointmentRepository {
	return &AppointmentRepository{db: db}
}

func (r *AppointmentRepository) Create(appointment *models.Appointment) error {
	return r.db.Create(appointment).Error
}

func (r *AppointmentRepository) GetByID(id uuid.UUID) (*models.Appointment, error) {
	var appointment models.Appointment
	err := r.db.Preload("Patient").Preload("Doctor").First(&appointment, "id = ?", id).Error
	return &appointment, err
}

func (r *AppointmentRepository) ListByPatient(patientID uuid.UUID) ([]models.Appointment, error) {
	var appointments []models.Appointment
	err := r.db.Preload("Doctor").Where("patient_id = ?", patientID).Order("date_time desc").Find(&appointments).Error
	return appointments, err
}

func (r *AppointmentRepository) ListByDoctor(doctorID uuid.UUID) ([]models.Appointment, error) {
	var appointments []models.Appointment
	err := r.db.Preload("Patient").Where("doctor_id = ?", doctorID).Order("date_time desc").Find(&appointments).Error
	return appointments, err
}

func (r *AppointmentRepository) Update(appointment *models.Appointment) error {
	return r.db.Save(appointment).Error
}

func (r *AppointmentRepository) ListAll() ([]models.Appointment, error) {
	var appointments []models.Appointment
	err := r.db.Preload("Patient").Preload("Doctor").Order("date_time desc").Find(&appointments).Error
	return appointments, err
}

func (r *AppointmentRepository) GetLastAppointmentForDay() (*models.Appointment, error) {
	var appointment models.Appointment
	// Get the last appointment created today
	err := r.db.Where("date_time >= CURRENT_DATE").Order("queue_number desc").First(&appointment).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return &appointment, nil
}

func (r *AppointmentRepository) HasPatientAppointmentToday(patientID uuid.UUID) (bool, error) {
	var count int64
	err := r.db.Model(&models.Appointment{}).
		Where("patient_id = ? AND date_time >= CURRENT_DATE AND date_time < CURRENT_DATE + INTERVAL '1 day'", patientID).
		Count(&count).Error
	return count > 0, err
}

func (r *AppointmentRepository) GetSubsequentAppointmentsForDoctorToday(doctorID uuid.UUID, queueNumber int) ([]models.Appointment, error) {
	var appointments []models.Appointment
	err := r.db.Where("doctor_id = ? AND date_time >= CURRENT_DATE AND date_time < CURRENT_DATE + INTERVAL '1 day' AND queue_number > ? AND status IN ('scheduled', 'arrived')", doctorID, queueNumber).Order("queue_number asc").Find(&appointments).Error
	return appointments, err
}

