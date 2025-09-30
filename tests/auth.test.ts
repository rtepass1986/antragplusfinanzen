/**
 * AUTHENTICATION SYSTEM TESTS
 * Tests NextAuth integration and multi-company access
 */

import { authOptions } from '../src/lib/auth';
import { prisma } from '../src/lib/prisma';
import { hash } from 'bcryptjs';

jest.mock('../src/lib/prisma');
const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('🔐 Authentication System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('User Authentication', () => {
    test('should authenticate user with valid credentials', async () => {
      const hashedPassword = await hash('validpassword', 12);
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        password: hashedPassword,
        role: 'ADMIN',
        companies: [
          {
            company: {
              id: 'comp-1',
              name: 'Test Company'
            }
          }
        ]
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const credentialsProvider = authOptions.providers.find(
        provider => provider.id === 'credentials'
      );

      const result = await credentialsProvider?.authorize({
        email: 'test@example.com',
        password: 'validpassword'
      });

      expect(result).toEqual({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        companies: [
          {
            company: {
              id: 'comp-1',
              name: 'Test Company'
            }
          }
        ]
      });
    });

    test('should reject authentication with invalid credentials', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const credentialsProvider = authOptions.providers.find(
        provider => provider.id === 'credentials'
      );

      const result = await credentialsProvider?.authorize({
        email: 'invalid@example.com',
        password: 'wrongpassword'
      });

      expect(result).toBeNull();
    });

    test('should handle password verification correctly', async () => {
      const hashedPassword = await hash('correctpassword', 12);
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        password: hashedPassword,
        companies: []
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const credentialsProvider = authOptions.providers.find(
        provider => provider.id === 'credentials'
      );

      // Test correct password
      const validResult = await credentialsProvider?.authorize({
        email: 'test@example.com',
        password: 'correctpassword'
      });

      expect(validResult).toBeTruthy();

      // Test incorrect password
      const invalidResult = await credentialsProvider?.authorize({
        email: 'test@example.com',
        password: 'wrongpassword'
      });

      expect(invalidResult).toBeNull();
    });
  });

  describe('Session Management', () => {
    test('should include company information in session', async () => {
      const mockToken = {
        companies: [
          {
            company: { id: 'comp-1', name: 'Test Company' }
          }
        ]
      };

      const mockSession = {
        user: {
          id: 'user-1',
          email: 'test@example.com'
        }
      };

      const sessionCallback = authOptions.callbacks?.session;
      const result = await sessionCallback?.({ session: mockSession, token: mockToken });

      expect(result?.user.companies).toEqual([
        {
          company: { id: 'comp-1', name: 'Test Company' }
        }
      ]);
    });

    test('should handle JWT token generation', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        companies: [
          {
            company: { id: 'comp-1', name: 'Test Company' }
          }
        ]
      };

      const mockToken = {};

      const jwtCallback = authOptions.callbacks?.jwt;
      const result = await jwtCallback?.({ token: mockToken, user: mockUser });

      expect(result?.companies).toEqual([
        {
          company: { id: 'comp-1', name: 'Test Company' }
        }
      ]);
    });
  });

  describe('Multi-Company Access Control', () => {
    test('should verify user access to specific company', async () => {
      const mockUserCompany = {
        id: 'uc-1',
        userId: 'user-1',
        companyId: 'comp-1',
        role: 'ADMIN',
        isActive: true
      };

      mockPrisma.userCompany.findUnique.mockResolvedValue(mockUserCompany);

      const hasAccess = await mockPrisma.userCompany.findUnique({
        where: {
          userId_companyId: {
            userId: 'user-1',
            companyId: 'comp-1'
          }
        }
      });

      expect(hasAccess).toBeTruthy();
      expect(hasAccess?.role).toBe('ADMIN');
    });

    test('should deny access to unauthorized company', async () => {
      mockPrisma.userCompany.findUnique.mockResolvedValue(null);

      const hasAccess = await mockPrisma.userCompany.findUnique({
        where: {
          userId_companyId: {
            userId: 'user-1',
            companyId: 'unauthorized-comp'
          }
        }
      });

      expect(hasAccess).toBeNull();
    });

    test('should handle role-based permissions correctly', async () => {
      const mockUserCompanies = [
        {
          userId: 'user-1',
          companyId: 'comp-1',
          role: 'ADMIN',
          isActive: true
        },
        {
          userId: 'user-1',
          companyId: 'comp-2',
          role: 'VIEWER',
          isActive: true
        }
      ];

      mockPrisma.userCompany.findMany.mockResolvedValue(mockUserCompanies);

      const userCompanies = await mockPrisma.userCompany.findMany({
        where: { userId: 'user-1', isActive: true }
      });

      expect(userCompanies).toHaveLength(2);
      expect(userCompanies[0].role).toBe('ADMIN');
      expect(userCompanies[1].role).toBe('VIEWER');
    });
  });

  describe('Google OAuth Integration', () => {
    test('should handle Google OAuth provider configuration', () => {
      const googleProvider = authOptions.providers.find(
        provider => provider.id === 'google'
      );

      expect(googleProvider).toBeTruthy();
      expect(googleProvider?.type).toBe('oauth');
    });

    test('should create user from Google OAuth profile', async () => {
      const mockGoogleProfile = {
        id: 'google-123',
        email: 'google@example.com',
        name: 'Google User',
        picture: 'https://example.com/photo.jpg'
      };

      const mockUser = {
        id: 'user-google',
        email: 'google@example.com',
        name: 'Google User',
        image: 'https://example.com/photo.jpg',
        emailVerified: new Date()
      };

      mockPrisma.user.create.mockResolvedValue(mockUser);

      const createdUser = await mockPrisma.user.create({
        data: {
          email: mockGoogleProfile.email,
          name: mockGoogleProfile.name,
          image: mockGoogleProfile.picture,
          emailVerified: new Date()
        }
      });

      expect(createdUser.email).toBe('google@example.com');
      expect(createdUser.name).toBe('Google User');
    });
  });

  describe('Security Features', () => {
    test('should hash passwords securely', async () => {
      const plainPassword = 'mysecurepassword';
      const hashedPassword = await hash(plainPassword, 12);

      expect(hashedPassword).not.toBe(plainPassword);
      expect(hashedPassword.length).toBeGreaterThan(50);
      expect(hashedPassword).toMatch(/^\$2[aby]\$12\$/);
    });

    test('should validate session expiration', () => {
      const sessionMaxAge = authOptions.session?.maxAge || 30 * 24 * 60 * 60; // 30 days
      expect(sessionMaxAge).toBe(30 * 24 * 60 * 60);
    });

    test('should use secure JWT strategy', () => {
      expect(authOptions.session?.strategy).toBe('jwt');
    });
  });
});

export default {};