# User Management System Guide

## Overview

The fintech SaaS application includes a comprehensive user management system with company-level access control, role-based permissions, and invitation workflows.

## Features

### 🔐 Authentication

- **Email/Password Login**: Traditional authentication with secure password hashing
- **Google OAuth**: Social login integration
- **Password Reset**: Secure password recovery system
- **Session Management**: JWT-based sessions with NextAuth.js

### 👥 User Management

- **Multi-Company Support**: Users can belong to multiple companies
- **Role-Based Access Control**: Granular permissions based on user roles
- **User Profiles**: Complete user information including department, job title, etc.
- **User Status Management**: Activate/deactivate users
- **Audit Logging**: Track all user management actions

### 🏢 Company Management

- **Company Creation**: Users can create and manage companies
- **Company Invitations**: Invite users to join companies via email
- **Company Roles**: Different access levels within companies
- **Company Settings**: Configurable company-specific settings

### 🔑 Permission System

- **Resource-Based Permissions**: Permissions tied to specific resources (invoices, users, reports, etc.)
- **Action-Based Permissions**: Granular control over actions (create, read, update, delete, approve)
- **Role Inheritance**: Permissions inherited from assigned roles
- **Direct Permissions**: Override role permissions with direct user permissions

## User Roles

### System Roles

- **SUPER_ADMIN**: Full system access across all companies
- **ADMIN**: Administrative access within assigned companies
- **USER**: Standard user access

### Company Roles

- **OWNER**: Full control over the company and all its resources
- **ADMIN**: Administrative access within the company
- **ACCOUNTANT**: Financial data access and management
- **APPROVER**: Invoice and expense approval permissions
- **EMPLOYEE**: Basic access to create and view own data
- **VIEWER**: Read-only access to company data

## Permission Matrix

| Resource | Action  | OWNER | ADMIN | ACCOUNTANT | APPROVER | EMPLOYEE | VIEWER |
| -------- | ------- | ----- | ----- | ---------- | -------- | -------- | ------ |
| Invoices | Create  | ✅    | ✅    | ✅         | ❌       | ✅       | ❌     |
| Invoices | Read    | ✅    | ✅    | ✅         | ✅       | ✅       | ✅     |
| Invoices | Update  | ✅    | ✅    | ✅         | ❌       | ❌       | ❌     |
| Invoices | Delete  | ✅    | ✅    | ❌         | ❌       | ❌       | ❌     |
| Invoices | Approve | ✅    | ✅    | ❌         | ✅       | ❌       | ❌     |
| Users    | Create  | ✅    | ✅    | ❌         | ❌       | ❌       | ❌     |
| Users    | Read    | ✅    | ✅    | ✅         | ✅       | ❌       | ❌     |
| Users    | Update  | ✅    | ✅    | ❌         | ❌       | ❌       | ❌     |
| Users    | Delete  | ✅    | ❌    | ❌         | ❌       | ❌       | ❌     |
| Company  | Read    | ✅    | ✅    | ✅         | ✅       | ✅       | ✅     |
| Company  | Update  | ✅    | ✅    | ❌         | ❌       | ❌       | ❌     |
| Reports  | Read    | ✅    | ✅    | ✅         | ✅       | ❌       | ✅     |
| Reports  | Export  | ✅    | ✅    | ✅         | ❌       | ❌       | ❌     |

## Database Schema

### Core Models

#### User

```prisma
model User {
  id             String    @id @default(cuid())
  email          String    @unique
  name           String?
  hashedPassword String?
  role           UserRole  @default(USER)
  emailVerified  DateTime?
  image          String?
  phone          String?
  department     String?
  jobTitle       String?
  isActive       Boolean   @default(true)
  lastLoginAt    DateTime?
  passwordResetToken String?
  passwordResetExpires DateTime?
  twoFactorEnabled Boolean @default(false)
  twoFactorSecret String?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
}
```

#### Company

```prisma
model Company {
  id          String   @id @default(cuid())
  name        String
  description String?
  taxId       String?
  address     String?
  phone       String?
  email       String?
  website     String?
  settings    Json?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

#### UserCompany (Junction Table)

```prisma
model UserCompany {
  id        String      @id @default(cuid())
  userId    String
  companyId String
  role      CompanyRole @default(EMPLOYEE)
  isActive  Boolean     @default(true)
  joinedAt  DateTime    @default(now())
  invitedAt DateTime?
  invitedBy String?
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt
}
```

#### Permission System

```prisma
model Permission {
  id          String   @id @default(cuid())
  name        String   @unique
  description String?
  resource    String
  action      String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Role {
  id          String   @id @default(cuid())
  name        String   @unique
  description String?
  isSystem    Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model UserPermission {
  id           String     @id @default(cuid())
  userId       String
  companyId    String
  permissionId String
  granted      Boolean    @default(true)
  grantedBy    String?
  grantedAt    DateTime   @default(now())
  expiresAt    DateTime?
}
```

## API Endpoints

### Authentication

- `POST /api/auth/register` - User registration
- `POST /api/auth/signin` - User login
- `POST /api/auth/signout` - User logout
- `GET /api/auth/session` - Get current session

### User Management

- `GET /api/users` - List users (admin only)
- `POST /api/users/invite` - Invite user to company
- `PATCH /api/users/[id]/status` - Update user status
- `GET /api/users/[id]` - Get user details

### Company Management

- `GET /api/companies` - List user's companies
- `POST /api/companies` - Create new company
- `PATCH /api/companies/[id]` - Update company
- `DELETE /api/companies/[id]` - Delete company

### Invitations

- `GET /api/invitations/[token]` - Get invitation details
- `POST /api/invitations/[token]/accept` - Accept invitation
- `POST /api/invitations/[token]/decline` - Decline invitation

## Setup Instructions

### 1. Database Setup

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Initialize permissions and roles
npm run db:seed
```

### 2. Environment Variables

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/fintech_saas"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key"

# Google OAuth (optional)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Start Development Server

```bash
npm run dev
```

## Usage Examples

### Check User Permissions

```typescript
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

// Check if user can create invoices
const canCreateInvoices = await hasPermission(
  userId,
  companyId,
  PERMISSIONS.INVOICES_CREATE
);

// Check if user can manage users
const canManageUsers = await hasPermission(
  userId,
  companyId,
  PERMISSIONS.USERS_CREATE
);
```

### Invite User to Company

```typescript
const response = await fetch('/api/users/invite', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    role: 'ACCOUNTANT',
    companyId: 'company-id',
  }),
});
```

### Get User's Companies

```typescript
const response = await fetch('/api/companies');
const { companies } = await response.json();
```

## Security Features

### Password Security

- Passwords are hashed using bcryptjs with salt rounds of 12
- Password reset tokens expire after 1 hour
- Password requirements enforced on registration

### Session Security

- JWT tokens with secure signing
- Session timeout configuration
- Secure cookie settings

### Permission Validation

- All API endpoints validate user permissions
- Middleware protects routes based on user roles
- Company-level access control enforced

### Audit Logging

- All user management actions are logged
- Includes user ID, action, entity, and timestamp
- Immutable audit trail for compliance

## Best Practices

### 1. Permission Checking

Always check permissions before allowing actions:

```typescript
// ✅ Good
const hasAccess = await hasPermission(
  userId,
  companyId,
  PERMISSIONS.INVOICES_DELETE
);
if (!hasAccess) {
  throw new Error('Insufficient permissions');
}

// ❌ Bad
// Assuming user has permission without checking
```

### 2. Company Context

Always include company context in API calls:

```typescript
// ✅ Good
const users = await prisma.user.findMany({
  where: {
    companies: {
      some: { companyId: currentUserCompanyId },
    },
  },
});

// ❌ Bad
// Getting all users without company filtering
```

### 3. Role Assignment

Assign appropriate roles based on user responsibilities:

- **Owners**: Company founders and primary administrators
- **Admins**: Department heads and senior staff
- **Accountants**: Financial team members
- **Approvers**: Managers who approve expenses/invoices
- **Employees**: Regular users who create data
- **Viewers**: Read-only access for stakeholders

## Troubleshooting

### Common Issues

1. **Permission Denied Errors**
   - Check if user has the required role
   - Verify company membership
   - Ensure permissions are properly initialized

2. **Invitation Not Working**
   - Check if invitation token is valid
   - Verify invitation hasn't expired
   - Ensure user email matches invitation

3. **Session Issues**
   - Clear browser cookies
   - Check NEXTAUTH_SECRET is set
   - Verify database connection

### Debug Mode

Enable debug logging by setting:

```env
NEXTAUTH_DEBUG=true
```

## Future Enhancements

- [ ] Two-factor authentication (2FA)
- [ ] Single Sign-On (SSO) integration
- [ ] Advanced audit reporting
- [ ] Bulk user operations
- [ ] Custom role creation
- [ ] API key management
- [ ] User activity monitoring
- [ ] Advanced permission inheritance
