package main

import (
	"log"
	"thakur-dental-clinic/backend/internal/config"
	"thakur-dental-clinic/backend/internal/utils"
)

func main() {
	cfg := config.Load()
	db, err := utils.InitDB(cfg)
	if err != nil {
		log.Fatalf("Failed to connect to DB: %v", err)
	}

	// Raw SQL to alter tables
	// NOTE: If columns already exist/renamed, some might fail, so we might want to be robust or just run it.
	// For this task, we assume clean transition or first run of this change.

	sqls := []string{
		`ALTER TABLE appointments DROP COLUMN IF EXISTS prescription_url;`,
		`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS prescription_urls TEXT;`,
		`ALTER TABLE blog_posts DROP COLUMN IF EXISTS image_url;`,
		`ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS image_urls TEXT;`,
	}

	for _, sql := range sqls {
		if err := db.Exec(sql).Error; err != nil {
			log.Printf("Error executing SQL: %s | Error: %v", sql, err)
		} else {
			log.Printf("Successfully executed: %s", sql)
		}
	}
}
