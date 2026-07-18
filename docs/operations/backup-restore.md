# Backup and Restore

## Create a Backup

Install PostgreSQL client tools, set `DATABASE_URL`, then run:

```powershell
./scripts/db/backup.ps1
```

The command creates a custom-format dump and a SHA-256 checksum under `backups/`. Store both outside the application host using encrypted storage and retention controls.

## Restore Drill

Restore into an isolated database first:

```powershell
$env:DATABASE_URL = "postgresql://user:password@host/loom_restore_test"
./scripts/db/restore.ps1 -BackupPath ./backups/loom-YYYYMMDD-HHMMSS.dump -ConfirmDatabaseName loom_restore_test
```

After restoration:

1. Run migrations to ensure the restored schema reaches the current version.
2. Verify conversation/message counts and model registry rows.
3. Start a backend instance and confirm readiness.
4. Run authentication, chat, model selection, and admin smoke tests.
5. Record recovery duration and compare it with the release RTO.

Never test restoration against the live production database.
