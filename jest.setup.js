import '@testing-library/jest-dom';

// Mock Next.js router
jest.mock('next/router', () => require('next-router-mock'));

// Mock AWS SDK
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({ success: true })
  })),
  PutObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn()
}));

jest.mock('@aws-sdk/client-textract', () => ({
  TextractClient: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({
      Blocks: [
        {
          BlockType: 'LINE',
          Text: 'Invoice Number: INV-001',
          Confidence: 95
        }
      ]
    })
  })),
  AnalyzeDocumentCommand: jest.fn()
}));


// Mock Prisma Client
jest.mock('./src/lib/prisma', () => ({
  prisma: {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    company: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn()
    },
    invoice: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn()
    },
    approvalWorkflow: {
      create: jest.fn(),
      findMany: jest.fn()
    },
    approvalTask: {
      create: jest.fn(),
      createMany: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn()
    },
    userCompany: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn()
    },
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn()
    },
    duplicateCheck: {
      create: jest.fn(),
      findMany: jest.fn()
    },
    bankAccount: {
      create: jest.fn(),
      upsert: jest.fn(),
      findMany: jest.fn()
    },
    transaction: {
      create: jest.fn(),
      findMany: jest.fn()
    },
    integrationConfig: {
      create: jest.fn(),
      upsert: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn()
    },
    cashFlowScenario: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn()
    },
    cashFlowForecast: {
      create: jest.fn(),
      createMany: jest.fn(),
      deleteMany: jest.fn(),
      findMany: jest.fn()
    },
    category: {
      createMany: jest.fn(),
      findMany: jest.fn()
    },
    exportLog: {
      create: jest.fn(),
      findMany: jest.fn()
    },
    lineItem: {
      createMany: jest.fn(),
      findMany: jest.fn()
    },
    delegation: {
      create: jest.fn(),
      findMany: jest.fn()
    },
    expense: {
      create: jest.fn(),
      findMany: jest.fn()
    }
  }
}));

// Global test utilities
global.testHelpers = {
  mockUser: {
    id: 'test-user-1',
    email: 'test@example.com',
    name: 'Test User',
    role: 'ADMIN'
  },
  mockCompany: {
    id: 'test-company-1',
    name: 'Test Company',
    settings: { defaultCurrency: 'EUR' }
  },
  mockInvoice: {
    id: 'test-invoice-1',
    invoiceNumber: 'INV-001',
    vendor: 'Test Vendor',
    totalAmount: 1000,
    companyId: 'test-company-1'
  }
};