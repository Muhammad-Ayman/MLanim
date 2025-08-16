#!/bin/bash

# Script to set up proper directory permissions for MLanim Docker containers
# This script should be run from the project root directory

set -e

echo "Setting up directory permissions for MLanim..."

# Get the current user ID and group ID
CURRENT_UID=$(id -u)
CURRENT_GID=$(id -g)

echo "Current user: $USER (UID: $CURRENT_UID, GID: $CURRENT_GID)"

# Create directories if they don't exist
mkdir -p outputs temp logs

# Set ownership to current user
echo "Setting ownership of directories..."
sudo chown -R $CURRENT_UID:$CURRENT_GID outputs temp logs

# Set proper permissions
echo "Setting directory permissions..."
sudo chmod -R 755 outputs temp logs
sudo chmod -R 775 outputs  # Make output directory writable by group

# If running in Docker, also set permissions for the container user (1001:1001)
if [ -f /.dockerenv ]; then
    echo "Running in Docker container, setting permissions for container user..."
    sudo chown -R 1001:1001 outputs temp logs
    sudo chmod -R 775 outputs temp logs
fi

echo "Directory permissions set successfully!"
echo "Directories:"
ls -la | grep -E "(outputs|temp|logs)"
echo ""
echo "You can now run the MLanim application."
