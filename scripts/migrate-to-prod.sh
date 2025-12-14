#!/bin/bash

# Migrate database from local docker to production server
# Usage: ./migrate-to-prod.sh [--drop-existing]

set -e

DROP_EXISTING=$1

# Configuration
PROD_HOST=${PROD_HOST:-10.0.0.105}
PROD_PORT=${PROD_PORT:-5432}
PROD_USER=${PROD_USER:-postgres}
PROD_DB=${PROD_DB:-countfolks}
TEMP_FILE="countfolks_migration_$(date +%Y%m%d_%H%M%S).sql"

echo "=========================================="
echo "Database Migration: Local → Production"
echo "=========================================="
echo ""
echo "Source: Local Docker (localhost)"
echo "Target: Production ($PROD_HOST:$PROD_PORT)"
echo ""

# Check if local docker-compose is running
if ! docker compose ps postgres > /dev/null 2>&1; then
    echo "✗ Error: Local docker-compose postgres container is not running!"
    echo "  Please start it with: docker compose up -d"
    exit 1
fi

# Step 1: Export from local docker
echo "Step 1: Exporting from local Docker database..."
docker compose exec -T postgres pg_dump -U postgres countfolks > "$TEMP_FILE"

if [ ! -f "$TEMP_FILE" ] || [ ! -s "$TEMP_FILE" ]; then
    echo "✗ Export failed!"
    exit 1
fi

FILE_SIZE=$(du -h "$TEMP_FILE" | cut -f1)
echo "✓ Exported successfully ($FILE_SIZE)"
echo ""

# Step 2: Get production password
if [ -z "$PROD_PASSWORD" ]; then
    read -sp "Enter production database password for user '$PROD_USER': " PROD_PASSWORD
    echo ""
    if [ -z "$PROD_PASSWORD" ]; then
        echo "✗ Password is required!"
        exit 1
    fi
fi

# Step 3: Test production connection
echo "Step 2: Testing production database connection..."
if ! PGPASSWORD=$PROD_PASSWORD psql -h "$PROD_HOST" -p "$PROD_PORT" -U "$PROD_USER" -d postgres -c "SELECT 1;" > /dev/null 2>&1; then
    echo "✗ Cannot connect to production database!"
    echo "  Please check:"
    echo "    - VPN connection is active"
    echo "    - Host: $PROD_HOST"
    echo "    - Port: $PROD_PORT"
    echo "    - Credentials are correct"
    exit 1
fi
echo "✓ Connection successful"
echo ""

# Step 4: Import to production
echo "Step 3: Importing to production database..."

if [ "$DROP_EXISTING" = "--drop-existing" ]; then
    echo "  Dropping existing database..."
    PGPASSWORD=$PROD_PASSWORD psql -h "$PROD_HOST" -p "$PROD_PORT" -U "$PROD_USER" -d postgres -c "DROP DATABASE IF EXISTS $PROD_DB;" 2>/dev/null || true
    PGPASSWORD=$PROD_PASSWORD psql -h "$PROD_HOST" -p "$PROD_PORT" -U "$PROD_USER" -d postgres -c "CREATE DATABASE $PROD_DB;" 2>/dev/null || true
    echo "  ✓ Database recreated"
fi

echo "  Importing data (this may take a moment)..."
PGPASSWORD=$PROD_PASSWORD psql -h "$PROD_HOST" -p "$PROD_PORT" -U "$PROD_USER" -d "$PROD_DB" < "$TEMP_FILE"

if [ $? -eq 0 ]; then
    echo "  ✓ Import completed successfully"
else
    echo "  ✗ Import failed!"
    exit 1
fi

echo ""

# Step 5: Verify import
echo "Step 4: Verifying import..."
RECORD_COUNT=$(PGPASSWORD=$PROD_PASSWORD psql -h "$PROD_HOST" -p "$PROD_PORT" -U "$PROD_USER" -d "$PROD_DB" -t -c "SELECT COUNT(*) FROM counts;" 2>/dev/null | xargs)
if [ ! -z "$RECORD_COUNT" ]; then
    echo "  ✓ Found $RECORD_COUNT records in production database"
else
    echo "  ⚠ Could not verify record count"
fi
echo ""

# Step 6: Cleanup
read -p "Delete temporary file? (y/n) [y]: " DELETE_TEMP
DELETE_TEMP=${DELETE_TEMP:-y}
if [ "$DELETE_TEMP" = "y" ] || [ "$DELETE_TEMP" = "Y" ]; then
    rm "$TEMP_FILE"
    echo "✓ Temporary file deleted"
else
    echo "  Temporary file kept: $TEMP_FILE"
fi

echo ""
echo "=========================================="
echo "Migration complete!"
echo "=========================================="
echo ""
echo "Production database: $PROD_HOST:$PROD_PORT/$PROD_DB"
echo "Records migrated: $RECORD_COUNT"

