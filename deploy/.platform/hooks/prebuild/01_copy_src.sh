#!/bin/bash
# Ensure source files are available for build
echo "Prebuild hook: Ensuring source files are available..."

# Check if src directory exists
if [ ! -d "src" ]; then
    echo "ERROR: src directory not found!"
    ls -la
    exit 1
fi

# List source files
echo "Source files found:"
find src -name "*.ts" | head -10

echo "Prebuild hook completed successfully."
