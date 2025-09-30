import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const projectData = await request.json();

    // Validate required fields
    if (!projectData.name) {
      return NextResponse.json(
        { error: 'Projektname ist erforderlich' },
        { status: 400 }
      );
    }

    // Create project in database
    const project = await prisma.project.create({
      data: {
        name: projectData.name,
        code: projectData.code,
        description: projectData.description,
        status: 'ACTIVE',
        startDate: projectData.startDate
          ? new Date(projectData.startDate)
          : null,
        endDate: projectData.endDate ? new Date(projectData.endDate) : null,
        budget: projectData.totalBudget,
        totalBudget: projectData.totalBudget,
        spentAmount: 0,
        remainingBudget: projectData.totalBudget,
        currency: projectData.currency || 'EUR',

        // Grant Giver Information
        grantGiverName: projectData.grantGiverName,
        grantGiverContact: projectData.grantGiverContact,
        grantGiverEmail: projectData.grantGiverEmail,
        grantGiverPhone: projectData.grantGiverPhone,
        grantGiverAddress: projectData.grantGiverAddress,
        grantReference: projectData.grantReference,
        grantAgreementUrl: projectData.grantAgreementUrl,

        // Reporting Framework
        reportingFrequency: projectData.reportingFrequency || 'MONTHLY',
        nextReportDue: projectData.nextReportDue
          ? new Date(projectData.nextReportDue)
          : null,
        lastReportSent: projectData.lastReportSent
          ? new Date(projectData.lastReportSent)
          : null,
        reportingTemplate: projectData.reportingTemplate,
        reportingEmail: projectData.reportingEmail,
        autoReporting: projectData.autoReporting || false,

        // Project Management
        projectManager: projectData.projectManager,
        teamMembers: projectData.teamMembers || [],
        milestones: projectData.milestones || [],
        deliverables: projectData.deliverables || [],
        risks: projectData.risks || [],

        // Financial Tracking
        categories: projectData.categories || [],
        budgetBreakdown: projectData.budgetBreakdown || {},

        // Default company ID (in a real app, this would come from authentication)
        companyId: 'default-company-id',
      },
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error('Error creating project:', error);
    return NextResponse.json(
      { error: 'Fehler beim Erstellen des Projekts' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId') || 'default-company-id';

    const projects = await prisma.project.findMany({
      where: {
        companyId: companyId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json(
      { error: 'Fehler beim Laden der Projekte' },
      { status: 500 }
    );
  }
}
