#!/bin/bash

# Transfer database from dev to production
# Usage: ./transfer-db.sh [--drop-existing]

set -e

DROP_EXISTING=$1

# Configuration
TEMP_FILE="countfolks_transfer_$(date +%Y%m%d_%H%M%S).sql"

echo "=========================================="
echo "Database Transfer Script"
echo "=========================================="
echo ""

# Step 1: Export from dev
echo "Step 1: Exporting from development database..."
if docker compose ps postgres > /dev/null 2>&1; then
    echo "  Using docker-compose environment..."
    docker compose exec -T postgres pg_dump -U postgres countfolks > "$TEMP_FILE"
else
    echo "  Using direct connection (set DB_HOST, DB_PORT, DB_USER, DB_PASSWORD)"
    DB_HOST=${DB_HOST:-localhost}
    DB_PORT=${DB_PORT:-5432}
    DB_USER=${DB_USER:-postgres}
    DB_NAME=${DB_NAME:-countfolks}
    PGPASSWORD=${DB_PASSWORD:-postgres} pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" > "$TEMP_FILE"
fi

if [ ! -f "$TEMP_FILE" ] || [ ! -s "$TEMP_FILE" ]; then
    echo "✗ Export failed!"
    exit 1
fi

FILE_SIZE=$(du -h "$TEMP_FILE" | cut -f1)
echo "✓ Exported successfully ($FILE_SIZE)"
echo ""

# Step 2: Import to production
echo "Step 2: Importing to production database..."
echo "  Please provide production database details:"
read -p "  Production DB Host [localhost]: " PROD_HOST
PROD_HOST=${PROD_HOST:-localhost}

read -p "  Production DB Port [5432]: " PROD_PORT
PROD_PORT=${PROD_PORT:-5432}

read -p "  Production DB User [postgres]: " PROD_USER
PROD_USER=${PROD_USER:-postgres}

read -sp "  Production DB Password: " PROD_PASSWORD
echo ""

read -p "  Production DB Name [countfolks]: " PROD_DB
PROD_DB=${PROD_DB:-countfolks}

if [ "$DROP_EXISTING" = "--drop-existing" ]; then
    echo "  Dropping existing production database..."
    PGPASSWORD=$PROD_PASSWORD psql -h "$PROD_HOST" -p "$PROD_PORT" -U "$PROD_USER" -c "DROP DATABASE IF EXISTS $PROD_DB;"
    PGPASSWORD=$PROD_PASSWORD psql -h "$PROD_HOST" -p "$PROD_PORT" -U "$PROD_USER" -c "CREATE DATABASE $PROD_DB;"
fi

echo "  Importing data..."
PGPASSWORD=$PROD_PASSWORD psql -h "$PROD_HOST" -p "$PROD_PORT" -U "$PROD_USER" -d "$PROD_DB" < "$TEMP_FILE"

echo ""
echo "✓ Import completed successfully!"
echo ""

# Step 3: Cleanup
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
echo "Transfer complete!"
echo "=========================================="


