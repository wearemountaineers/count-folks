#!/bin/bash

# Export database script for count-folks
# Usage: ./export-db.sh [output_file]

set -e

OUTPUT_FILE=${1:-"countfolks_backup_$(date +%Y%m%d_%H%M%S).sql"}

echo "Exporting database..."
echo "Output file: $OUTPUT_FILE"

# Check if running in docker-compose environment
if docker compose ps postgres > /dev/null 2>&1; then
    echo "Using docker-compose postgres container..."
    docker compose exec -T postgres pg_dump -U postgres countfolks > "$OUTPUT_FILE"
else
    # Direct database connection (for production)
    DB_HOST=${DB_HOST:-localhost}
    DB_PORT=${DB_PORT:-5432}
    DB_USER=${DB_USER:-postgres}
    DB_NAME=${DB_NAME:-countfolks}
    
    echo "Connecting to database at $DB_HOST:$DB_PORT..."
    PGPASSWORD=${DB_PASSWORD:-postgres} pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" > "$OUTPUT_FILE"
fi

if [ -f "$OUTPUT_FILE" ] && [ -s "$OUTPUT_FILE" ]; then
    FILE_SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)
    echo "✓ Database exported successfully!"
    echo "  File: $OUTPUT_FILE"
    echo "  Size: $FILE_SIZE"
else
    echo "✗ Export failed!"
    exit 1
fi


