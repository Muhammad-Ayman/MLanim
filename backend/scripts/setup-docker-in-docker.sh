#!/bin/bash

# Script to set up Docker-in-Docker for MLanim
# This script configures the host system to allow the backend container to spawn Manim containers

set -e

echo "🐳 Setting up Docker-in-Docker for MLanim..."
echo "=============================================="

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   echo "❌ This script should not be run as root"
   echo "💡 Please run as a regular user with sudo access"
   exit 1
fi

# Get current user info
CURRENT_USER=$(whoami)
CURRENT_UID=$(id -u)
CURRENT_GID=$(id -g)

echo "👤 Current user: $CURRENT_USER (UID: $CURRENT_UID, GID: $CURRENT_GID)"

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo "❌ Docker is not running or not accessible"
    echo "💡 Please start Docker Desktop or Docker daemon first"
    exit 1
fi

echo "✅ Docker is running"

# Check Docker socket permissions
DOCKER_SOCKET="/var/run/docker.sock"
if [[ ! -S "$DOCKER_SOCKET" ]]; then
    echo "❌ Docker socket not found at $DOCKER_SOCKET"
    echo "💡 Docker might not be running or using a different socket"
    exit 1
fi

# Check if user is in docker group
if groups $CURRENT_USER | grep -q '\bdocker\b'; then
    echo "✅ User $CURRENT_USER is in docker group"
else
    echo "⚠️  User $CURRENT_USER is not in docker group"
    echo "💡 Adding user to docker group..."
    sudo usermod -aG docker $CURRENT_USER
    echo "✅ User added to docker group"
    echo "💡 You may need to log out and back in for changes to take effect"
fi

# Check Docker socket permissions
DOCKER_SOCKET_PERMS=$(stat -c "%a" $DOCKER_SOCKET)
DOCKER_SOCKET_OWNER=$(stat -c "%U:%G" $DOCKER_SOCKET)

echo "🔐 Docker socket permissions: $DOCKER_SOCKET_PERMS (owner: $DOCKER_SOCKET_OWNER)"

# Create project directories with proper permissions
echo "📁 Creating project directories..."
mkdir -p outputs temp logs

# Set directory ownership to current user
echo "👤 Setting directory ownership..."
sudo chown -R $CURRENT_USER:$CURRENT_USER outputs temp logs

# Set directory permissions
echo "🔐 Setting directory permissions..."
sudo chmod -R 755 outputs temp logs
sudo chmod -R 775 outputs  # Make output directory writable by group

# Verify permissions
echo "✅ Verifying directory permissions..."
ls -la | grep -E "(outputs|temp|logs)"

# Test Docker-in-Docker capability
echo "🧪 Testing Docker-in-Docker capability..."
if docker run --rm alpine:latest echo "Docker-in-Docker test successful" >/dev/null 2>&1; then
    echo "✅ Docker-in-Docker test passed"
else
    echo "❌ Docker-in-Docker test failed"
    echo "💡 This might be a permission issue with the Docker socket"
    exit 1
fi

# Test volume mounting
echo "🧪 Testing volume mounting..."
TEST_FILE="outputs/docker-test.txt"
if docker run --rm -v "$(pwd)/outputs:/output:rw" alpine:latest sh -c "echo 'test' > /output/docker-test.txt" >/dev/null 2>&1; then
    if [[ -f "$TEST_FILE" ]]; then
        echo "✅ Volume mounting test passed"
        rm -f "$TEST_FILE"
    else
        echo "❌ Volume mounting test failed - file not created"
        exit 1
    fi
else
    echo "❌ Volume mounting test failed"
    exit 1
fi

echo ""
echo "🎉 Docker-in-Docker setup completed successfully!"
echo ""
echo "📋 Summary:"
echo "   ✅ Docker is running and accessible"
echo "   ✅ User $CURRENT_USER has Docker access"
echo "   ✅ Project directories created with proper permissions"
echo "   ✅ Docker-in-Docker capability verified"
echo "   ✅ Volume mounting verified"
echo ""
echo "🚀 You can now run MLanim with:"
echo "   docker-compose up"
echo ""
echo "💡 If you encounter permission issues:"
echo "   1. Log out and log back in (for group changes to take effect)"
echo "   2. Restart Docker Desktop"
echo "   3. Check Docker socket permissions: ls -la /var/run/docker.sock"
