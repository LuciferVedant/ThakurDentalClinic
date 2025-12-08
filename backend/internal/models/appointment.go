package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type AppointmentStatus string

const (
	AppointmentStatusScheduled AppointmentStatus = "scheduled"
	AppointmentStatusCompleted AppointmentStatus = "completed"
	AppointmentStatusCancelled AppointmentStatus = "cancelled"
)

type Appointment struct {
	ID               uuid.UUID         `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	PatientID        uuid.UUID         `gorm:"type:uuid;not null" json:"patientId"`
	DoctorID         uuid.UUID         `gorm:"type:uuid;not null" json:"doctorId"`
	DateTime         time.Time         `gorm:"not null" json:"dateTime"`
	Status           AppointmentStatus `gorm:"type:varchar(20);default:'scheduled'" json:"status"`
	PrescriptionURLs string            `gorm:"type:text" json:"prescriptionUrls"` // JSON array of strings
	Notes            string            `gorm:"type:text" json:"notes"`
	CreatedAt        time.Time         `json:"createdAt"`
	UpdatedAt        time.Time         `json:"updatedAt"`

	// Associations
	Patient User `gorm:"foreignKey:PatientID" json:"patient,omitempty"`
	Doctor  User `gorm:"foreignKey:DoctorID" json:"doctor,omitempty"`
}

// BeforeCreate hook to generate UUID
func (a *Appointment) BeforeCreate(tx *gorm.DB) error {
	if a.ID == uuid.Nil {
		a.ID = uuid.New()
	}
	return nil
}

// TableName specifies the table name for Appointment model
func (Appointment) TableName() string {
	return "appointments"
}
