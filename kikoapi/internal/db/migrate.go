// Package db: Run SQL migrations (golang-migrate).

package db

import (
	"fmt"
	"path/filepath"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
)

// MigrateUp runs all pending up migrations from the given directory.
// dir should contain files like 000001_name.up.sql.
func MigrateUp(databaseURL, migrationsDir string) error {
	if databaseURL == "" {
		return fmt.Errorf("database URL is required")
	}
	absDir, err := filepath.Abs(migrationsDir)
	if err != nil {
		return err
	}
	m, err := migrate.New(
		"file://"+absDir,
		databaseURL,
	)
	if err != nil {
		return err
	}
	defer m.Close()
	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		return err
	}
	return nil
}
