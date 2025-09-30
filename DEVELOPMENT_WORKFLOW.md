# 🚀 Development Workflow & Code Quality

## **Available Commands**

### **Development**

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
```

### **Code Quality**

```bash
npm run lint         # Check for linting issues
npm run lint:fix     # Auto-fix linting issues
npm run format       # Format all code with Prettier
npm run format:check # Check if code is properly formatted
npm run type-check   # TypeScript type checking
```

## **Automatic Code Quality**

### **Pre-commit Hooks (Husky)**

- **Automatically runs** before every commit
- **Lints and formats** staged files
- **Prevents commits** with linting errors

### **VS Code Integration**

- **Auto-format on save** with Prettier
- **ESLint error highlighting** in real-time
- **Auto-fix on save** for common issues
- **Tailwind CSS IntelliSense**

## **Code Style Rules**

### **ESLint Rules**

- **TypeScript strict mode** enabled
- **React best practices** enforced
- **Next.js specific rules** applied
- **Import/export consistency** checked

### **Prettier Configuration**

- **Single quotes** for strings
- **Trailing commas** for cleaner diffs
- **80 character line width**
- **2 space indentation**
- **Semicolons** required

## **Workflow Best Practices**

### **1. Before Starting Work**

```bash
git pull origin main
npm install
npm run lint
```

### **2. During Development**

- **Save frequently** (auto-formatting happens)
- **Check linting** with `npm run lint`
- **Fix issues** with `npm run lint:fix`

### **3. Before Committing**

```bash
npm run lint:fix
npm run format
npm run type-check
git add .
git commit -m "feat: add new feature"
```

### **4. Before Pushing**

```bash
npm run build
npm run lint
```

## **VS Code Extensions (Recommended)**

### **Essential Extensions**

- **ESLint** - JavaScript/TypeScript linting
- **Prettier** - Code formatter
- **Tailwind CSS IntelliSense** - CSS classes
- **TypeScript Importer** - Auto-imports
- **Auto Rename Tag** - HTML/JSX editing

### **Settings (Already Configured)**

- Auto-format on save
- ESLint auto-fix on save
- Prettier as default formatter
- Tailwind CSS language support

## **Troubleshooting**

### **Common Issues**

#### **ESLint Errors**

```bash
npm run lint:fix    # Auto-fix issues
npm run lint        # Check remaining issues
```

#### **Prettier Conflicts**

```bash
npm run format      # Reformat all files
npm run lint:fix    # Fix any remaining issues
```

#### **TypeScript Errors**

```bash
npm run type-check  # Check for type errors
```

### **Reset Linting Cache**

```bash
rm -rf .eslintcache
npm run lint
```

## **Configuration Files**

### **ESLint (.eslintrc.json)**

- Extends Next.js and Prettier configs
- Custom rules for project needs
- TypeScript-specific configurations

### **Prettier (.prettierrc)**

- Consistent code formatting
- Project-specific style preferences
- Integration with ESLint

### **Husky (.husky/pre-commit)**

- Pre-commit code quality checks
- Automatic linting and formatting
- Ensures clean commits

## **Team Collaboration**

### **Code Review Checklist**

- [ ] Code follows ESLint rules
- [ ] Prettier formatting applied
- [ ] TypeScript types are correct
- [ ] No console.log statements
- [ ] Proper error handling
- [ ] Responsive design considerations

### **Commit Message Convention**

```
feat: add new feature
fix: bug fix
docs: documentation changes
style: formatting changes
refactor: code refactoring
test: add tests
chore: maintenance tasks
```

## **Performance Tips**

### **Development**

- **Hot reload** with Next.js
- **Fast builds** with optimized configs
- **Efficient linting** with file watching

### **Production**

- **Tree shaking** for smaller bundles
- **Code splitting** for better performance
- **Optimized images** and assets

---

**Happy Coding! 🎉**
