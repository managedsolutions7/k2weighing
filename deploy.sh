#!/bin/bash

echo "🚀 Starting deployment process..."

# Clean previous build
echo "🧹 Cleaning previous build..."
rm -rf dist/

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build the application locally to test
echo "🔨 Building application locally to test..."
npm run build

# Check if build was successful
if [ ! -d "dist" ]; then
    echo "❌ Build failed! dist directory not found."
    exit 1
fi

echo "✅ Local build completed successfully!"

# Deploy to Elastic Beanstalk (will build on server)
echo "📤 Deploying to Elastic Beanstalk..."
eb deploy

echo "🎉 Deployment completed!"
