package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type UserType string

const (
	UserTypePatient      UserType = "patient"
	UserTypeDoctor       UserType = "doctor"
	UserTypeReceptionist UserType = "receptionist"
)

type User struct {
	ID             uuid.UUID  `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	Email          string     `gorm:"uniqueIndex;not null" json:"email"`
	PasswordHash   *string    `gorm:"type:varchar(255)" json:"-"`
	FirstName      string     `gorm:"not null" json:"firstName"`
	LastName       string     `gorm:"not null" json:"lastName"`
	Age            int        `json:"age"`
	Gender         string     `gorm:"type:varchar(20)" json:"gender"`
	Address        string     `json:"address"`
	ProfilePicture string     `json:"profilePicture"`
	Phone          string     `json:"phone"`
	UserType       UserType   `gorm:"type:varchar(20);not null" json:"userType"`
	IsAdmin        bool       `gorm:"default:false" json:"isAdmin"`
	IsActive       bool       `gorm:"default:true" json:"isActive"`
	CreatedBy      *uuid.UUID `gorm:"type:uuid" json:"createdBy,omitempty"`
	CreatedAt      time.Time  `json:"createdAt"`
	UpdatedAt      time.Time  `json:"updatedAt"`

	// Associations
	OAuthAccounts []OAuthAccount `gorm:"foreignKey:UserID" json:"oauthAccounts,omitempty"`
	Creator       *User          `gorm:"foreignKey:CreatedBy" json:"creator,omitempty"`
}

// BeforeCreate hook to generate UUID
func (u *User) BeforeCreate(tx *gorm.DB) error {
	if u.ID == uuid.Nil {
		u.ID = uuid.New()
	}
	return nil
}

// TableName specifies the table name for User model
func (User) TableName() string {
	return "users"
}
