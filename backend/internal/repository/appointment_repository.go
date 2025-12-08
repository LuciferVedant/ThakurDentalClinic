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
