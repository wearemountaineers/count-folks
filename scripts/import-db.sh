#!/bin/bash

# Import database script for count-folks
# Usage: ./import-db.sh <input_file> [--drop-existing]

set -e

if [ -z "$1" ]; then
    echo "Usage: $0 <input_file> [--drop-existing]"
    echo "Example: $0 countfolks_backup_20240101_120000.sql"
    exit 1
fi

INPUT_FILE=$1
DROP_EXISTING=$2

if [ ! -f "$INPUT_FILE" ]; then
    echo "Error: File '$INPUT_FILE' not found!"
    exit 1
fi

echo "Importing database from: $INPUT_FILE"

# Check if running in docker-compose environment
if docker compose ps postgres > /dev/null 2>&1; then
    echo "Using docker-compose postgres container..."
    
    if [ "$DROP_EXISTING" = "--drop-existing" ]; then
        echo "Dropping existing database..."
        docker compose exec -T postgres psql -U postgres -c "DROP DATABASE IF EXISTS countfolks;"
        docker compose exec -T postgres psql -U postgres -c "CREATE DATABASE countfolks;"
    fi
    
    docker compose exec -T postgres psql -U postgres -d countfolks < "$INPUT_FILE"
else
    # Direct database connection (for production)
    DB_HOST=${DB_HOST:-localhost}
    DB_PORT=${DB_PORT:-5432}
    DB_USER=${DB_USER:-postgres}
    DB_NAME=${DB_NAME:-countfolks}
    
    echo "Connecting to database at $DB_HOST:$DB_PORT..."
    
    if [ "$DROP_EXISTING" = "--drop-existing" ]; then
        echo "Dropping existing database..."
        PGPASSWORD=${DB_PASSWORD:-postgres} psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -c "DROP DATABASE IF EXISTS $DB_NAME;"
        PGPASSWORD=${DB_PASSWORD:-postgres} psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -c "CREATE DATABASE $DB_NAME;"
    fi
    
    PGPASSWORD=${DB_PASSWORD:-postgres} psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" < "$INPUT_FILE"
fi

echo "✓ Database imported successfully!"

