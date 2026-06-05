package cron

import (
	"encoding/json"
	"log"
	"thakur-dental-clinic/backend/internal/models"
	"thakur-dental-clinic/backend/internal/services"
	"time"

	"gorm.io/gorm"
)

// StartReminderWorker starts a background ticker to send pre-arrival reminders
func StartReminderWorker(db *gorm.DB) {
	ticker := time.NewTicker(2 * time.Minute)
	go func() {
		// Run initial check immediately
		CheckReminders(db)
		for range ticker.C {
			CheckReminders(db)
		}
	}()
}

func CheckReminders(db *gorm.DB) {
	log.Println("[Reminder Worker] Checking for upcoming appointments...")
	var appointments []models.Appointment
	now := time.Now()
	thirtyMinsLater := now.Add(30 * time.Minute)

	// Fetch upcoming scheduled appointments where reminder hasn't been sent yet
	err := db.Preload("Patient").Preload("Doctor").
		Where("status = ? AND estimated_start_time >= ? AND estimated_start_time <= ? AND reminder_sent = ?",
			models.AppointmentStatusScheduled, now, thirtyMinsLater, false).
		Find(&appointments).Error

	if err != nil {
		log.Printf("[Reminder Worker] Error querying appointments: %v", err)
		return
	}

	for _, app := range appointments {
		app.ReminderSent = true
		if err := db.Save(&app).Error; err != nil {
			log.Printf("[Reminder Worker] Error updating appointment %s: %v", app.ID, err)
			continue
		}

		// Log dispatch to console as a demo fallback
		log.Printf("[DEMO REMINDER SENT] Patient: %s %s, Time: %s, Doctor: Dr. %s %s",
			app.Patient.FirstName, app.Patient.LastName,
			app.EstimatedStartTime.Format("15:04"),
			app.Doctor.FirstName, app.Doctor.LastName)

		// Dispatch SSE notification
		if services.NotifyFunc != nil {
			payload, err := json.Marshal(map[string]interface{}{
				"type":          "PRE_ARRIVAL_REMINDER",
				"appointmentId": app.ID.String(),
				"message":       "Your appointment starts in less than 30 minutes. Please arrive at the clinic.",
			})
			if err == nil {
				services.NotifyFunc(app.PatientID.String(), string(payload))
			}
		}
	}
}
