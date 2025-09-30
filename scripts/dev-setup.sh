#!/bin/bash

# 🚀 FinTech SaaS Development Setup Script
# This script sets up your development environment

echo "🚀 Setting up FinTech SaaS Development Environment..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Setup Husky
echo "🐕 Setting up Husky pre-commit hooks..."
npm run prepare

# Run initial quality check
echo "🔍 Running initial quality check..."
npm run quality:check

echo ""
echo "🎉 Setup complete! Here's what you can do next:"
echo ""
echo "📚 Read the documentation:"
echo "   - QUICK_START.md - Get started in 5 minutes"
echo "   - DEVELOPMENT_WORKFLOW.md - Complete workflow guide"
echo ""
echo "🚀 Start development:"
echo "   npm run dev"
echo ""
echo "🔧 Quality commands:"
echo "   npm run quality      - Fix all issues + format + type-check"
echo "   npm run lint:fix     - Quick fix for linting issues"
echo "   npm run quality:check - Check without fixing"
echo ""
echo "💡 Pro tip: Save frequently in VS Code for auto-formatting!"
echo ""
echo "Happy coding! 🎯" 