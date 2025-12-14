# Database Scripts

Helper scripts for database backup, export, import, and transfer operations.

## Scripts

### export-db.sh

Exports the database to a SQL file.

**Usage:**
```bash
# Export to auto-named file (timestamped)
./scripts/export-db.sh

# Export to specific file
./scripts/export-db.sh my_backup.sql
```

**Environment Variables (for remote databases):**
- `DB_HOST` - Database host (default: localhost)
- `DB_PORT` - Database port (default: 5432)
- `DB_USER` - Database user (default: postgres)
- `DB_PASSWORD` - Database password (default: postgres)
- `DB_NAME` - Database name (default: countfolks)

**Examples:**
```bash
# Export from docker-compose
./scripts/export-db.sh

# Export from remote database
DB_HOST=prod.example.com DB_PASSWORD=secret ./scripts/export-db.sh prod_backup.sql
```

### import-db.sh

Imports a SQL file into the database.

**Usage:**
```bash
# Import database
./scripts/import-db.sh backup.sql

# Import and drop existing database first
./scripts/import-db.sh backup.sql --drop-existing
```

**Environment Variables (for remote databases):**
- Same as export-db.sh

**Examples:**
```bash
# Import to docker-compose
./scripts/import-db.sh backup.sql

# Import to remote database
DB_HOST=prod.example.com DB_PASSWORD=secret ./scripts/import-db.sh backup.sql
```

### transfer-db.sh

Interactive script to transfer database from development to production.

**Usage:**
```bash
# Interactive transfer
./scripts/transfer-db.sh

# Transfer and drop existing production database first
./scripts/transfer-db.sh --drop-existing
```

**What it does:**
1. Exports from development database (docker-compose or remote)
2. Prompts for production database credentials
3. Imports to production database
4. Optionally cleans up temporary files

### migrate-to-prod.sh

**Recommended for local → production migration**

Migrates database from local Docker to production server (e.g., over VPN).

**Usage:**
```bash
# Migrate to production (defaults to 10.0.0.105)
./scripts/migrate-to-prod.sh

# Migrate and drop existing production database first
./scripts/migrate-to-prod.sh --drop-existing
```

**Environment Variables:**
```bash
# Set production connection details
export PROD_HOST=10.0.0.105
export PROD_PORT=5432
export PROD_USER=postgres
export PROD_DB=countfolks
export PROD_PASSWORD=yourpassword  # Optional, will prompt if not set

./scripts/migrate-to-prod.sh
```

**What it does:**
1. Exports from local docker-compose postgres
2. Tests connection to production server
3. Imports to production database
4. Verifies import by counting records
5. Optionally cleans up temporary files

**Example:**
```bash
# Quick migration (will prompt for password)
./scripts/migrate-to-prod.sh

# With password in environment (no prompt)
PROD_PASSWORD=secret ./scripts/migrate-to-prod.sh

# Drop existing data first
PROD_PASSWORD=secret ./scripts/migrate-to-prod.sh --drop-existing
```

## Quick Examples

### Export from Dev, Import to Prod

**Method 1: Using transfer script (easiest)**
```bash
./scripts/transfer-db.sh
```

**Method 2: Manual two-step process**
```bash
# Step 1: Export from dev
./scripts/export-db.sh dev_backup.sql

# Step 2: Import to prod
DB_HOST=prod.example.com DB_PASSWORD=prodpass ./scripts/import-db.sh dev_backup.sql
```

### Using Makefile

```bash
# Export database
make db-export

# Import database
make db-import FILE=backup.sql

# Transfer database
make db-transfer
```

## Notes

- Scripts automatically detect if running in docker-compose environment
- For remote databases, you need `pg_dump` and `psql` installed locally
- Install PostgreSQL client tools: `sudo apt install postgresql-client`
- Scripts preserve all data including timestamps and relationships

