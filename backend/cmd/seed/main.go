package main

import (
	"log"
	"thakur-dental-clinic/backend/internal/config"
	"thakur-dental-clinic/backend/internal/models"
	"thakur-dental-clinic/backend/internal/utils"
)

func main() {
	// Load configuration
	cfg := config.Load()

	// Initialize database
	db, err := utils.InitDB(cfg)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	log.Println("Resetting database...")

	// Truncate tables (using CASCADE to handle foreign keys)
	// Note: This is PostgreSQL specific syntax
	if err := db.Exec("TRUNCATE TABLE users CASCADE").Error; err != nil {
		log.Fatalf("Failed to truncate users table: %v", err)
	}

	log.Println("Database reset successfully.")

	// Create Admin User
	admin := &models.User{
		Email:     "vedrocks2000@gmail.com",
		FirstName: "Admin",
		LastName:  "User",
		UserType:  models.UserTypeDoctor,
		IsAdmin:   true,
		IsActive:  true,
	}

	log.Printf("Creating admin user: %s", admin.Email)

	if err := db.Create(admin).Error; err != nil {
		log.Fatalf("Failed to create admin user: %v", err)
	}

	log.Println("Admin user created successfully!")
	log.Println("You can now login with Google using this email to access the admin dashboard.")
}
