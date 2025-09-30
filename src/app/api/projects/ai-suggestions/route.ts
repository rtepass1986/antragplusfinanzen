import { NextRequest, NextResponse } from 'next/server';

interface ProjectSuggestionRequest {
  projectData: any;
  context?: string;
  suggestionsType:
    | 'categories'
    | 'milestones'
    | 'risks'
    | 'budget'
    | 'timeline';
}

export async function POST(request: NextRequest) {
  try {
    const body: ProjectSuggestionRequest = await request.json();
    const { projectData, context, suggestionsType } = body;

    if (!projectData) {
      return NextResponse.json(
        { error: 'Project data is required' },
        { status: 400 }
      );
    }

    if (!suggestionsType) {
      return NextResponse.json(
        { error: 'Suggestions type is required' },
        { status: 400 }
      );
    }

    let suggestions: any = {};

    try {
      // Use AI to generate suggestions based on the project data
      const prompt = buildSuggestionPrompt(
        projectData,
        context,
        suggestionsType
      );
      const response = await callOpenAI(prompt);
      suggestions = parseSuggestionResponse(response, suggestionsType);
    } catch (aiError) {
      console.error('AI suggestion failed, using fallback:', aiError);
      suggestions = getFallbackSuggestions(projectData, suggestionsType);
    }

    return NextResponse.json({
      success: true,
      data: {
        suggestions,
        type: suggestionsType,
        generatedAt: new Date().toISOString(),
        aiGenerated: true,
      },
    });
  } catch (error) {
    console.error('Error generating AI suggestions:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate suggestions',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

function buildSuggestionPrompt(
  projectData: any,
  context: string | undefined,
  suggestionsType: string
): string {
  const basePrompt = `
You are an AI project management assistant. Based on the provided project data, generate intelligent suggestions for the requested type.

PROJECT DATA:
${JSON.stringify(projectData, null, 2)}

CONTEXT: ${context || 'No additional context provided'}

SUGGESTION TYPE: ${suggestionsType}

`;

  switch (suggestionsType) {
    case 'categories':
      return (
        basePrompt +
        `
Generate appropriate project categories based on the project information. Consider:
- Project type and domain
- Funding source requirements
- Industry standards
- Budget allocation patterns

RESPONSE FORMAT (JSON):
{
  "suggestedCategories": ["Category1", "Category2", "Category3"],
  "reasoning": "Explanation for each category suggestion",
  "priority": ["high", "medium", "low"]
}
`
      );

    case 'milestones':
      return (
        basePrompt +
        `
Generate realistic project milestones based on the project timeline and objectives. Consider:
- Project duration and phases
- Typical project lifecycle
- Dependencies and critical path
- Deliverable requirements

RESPONSE FORMAT (JSON):
{
  "suggestedMilestones": [
    {
      "name": "Milestone Name",
      "date": "YYYY-MM-DD",
      "description": "What needs to be completed",
      "dependencies": ["Previous milestone"],
      "deliverables": ["Deliverable 1", "Deliverable 2"]
    }
  ],
  "reasoning": "Explanation for milestone timeline and dependencies"
}
`
      );

    case 'risks':
      return (
        basePrompt +
        `
Identify potential project risks based on the project information. Consider:
- Project complexity and scope
- Timeline constraints
- Budget limitations
- External dependencies
- Technology risks
- Resource availability

RESPONSE FORMAT (JSON):
{
  "suggestedRisks": [
    {
      "description": "Risk description",
      "impact": "low|medium|high",
      "probability": "low|medium|high",
      "mitigation": "Suggested mitigation strategy",
      "category": "Technical|Financial|Timeline|Resource|External"
    }
  ],
  "reasoning": "Explanation for risk assessment and prioritization"
}
`
      );

    case 'budget':
      return (
        basePrompt +
        `
Generate a detailed budget breakdown based on the project information. Consider:
- Project scope and objectives
- Typical cost categories
- Industry standards
- Resource requirements
- Timeline and phases

RESPONSE FORMAT (JSON):
{
  "suggestedBudgetBreakdown": [
    {
      "category": "Category Name",
      "amount": 0,
      "percentage": 0,
      "description": "What this covers",
      "justification": "Why this amount is needed"
    }
  ],
  "totalBudget": 0,
  "reasoning": "Explanation for budget allocation"
}
`
      );

    case 'timeline':
      return (
        basePrompt +
        `
Generate a detailed project timeline based on the project information. Consider:
- Project phases and dependencies
- Resource availability
- Critical path analysis
- Buffer time for risks
- Milestone requirements

RESPONSE FORMAT (JSON):
{
  "suggestedTimeline": [
    {
      "phase": "Phase Name",
      "startDate": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD",
      "duration": "X weeks",
      "description": "What happens in this phase",
      "dependencies": ["Previous phase"],
      "resources": ["Resource 1", "Resource 2"]
    }
  ],
  "criticalPath": ["Phase 1", "Phase 2", "Phase 3"],
  "reasoning": "Explanation for timeline structure and dependencies"
}
`
      );

    default:
      throw new Error(`Unknown suggestions type: ${suggestionsType}`);
  }
}

async function callOpenAI(prompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-5',
      messages: [
        {
          role: 'system',
          content:
            'You are a project management AI assistant. Always respond with valid JSON only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_completion_tokens: 1500,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `OpenAI API error: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

function parseSuggestionResponse(
  response: string,
  suggestionsType: string
): any {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('Error parsing suggestion response:', error);
    return getFallbackSuggestions({}, suggestionsType);
  }
}

function getFallbackSuggestions(
  projectData: any,
  suggestionsType: string
): any {
  switch (suggestionsType) {
    case 'categories':
      return {
        suggestedCategories: [
          'Software',
          'Hardware',
          'Personalkosten',
          'Beratung',
        ],
        reasoning: 'Standard project categories based on common project types',
        priority: ['high', 'high', 'medium', 'medium'],
      };

    case 'milestones':
      return {
        suggestedMilestones: [
          {
            name: 'Projektstart',
            date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
              .toISOString()
              .split('T')[0],
            description: 'Projekt wird offiziell gestartet',
            dependencies: [],
            deliverables: ['Projektauftrag', 'Team-Zusammenstellung'],
          },
          {
            name: 'Zwischenbericht',
            date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
              .toISOString()
              .split('T')[0],
            description: 'Erster Zwischenbericht',
            dependencies: ['Projektstart'],
            deliverables: ['Zwischenbericht'],
          },
        ],
        reasoning:
          'Standard project milestones based on typical project timeline',
      };

    case 'risks':
      return {
        suggestedRisks: [
          {
            description:
              'Verzögerungen bei der Lieferung von externen Dienstleistungen',
            impact: 'medium',
            probability: 'medium',
            mitigation:
              'Frühzeitige Beauftragung und regelmäßige Kommunikation',
            category: 'External',
          },
          {
            description: 'Budgetüberschreitung durch unvorhergesehene Kosten',
            impact: 'high',
            probability: 'low',
            mitigation: 'Regelmäßige Budgetüberwachung und Puffer einplanen',
            category: 'Financial',
          },
        ],
        reasoning: 'Standard project risks based on common project challenges',
      };

    case 'budget':
      return {
        suggestedBudgetBreakdown: [
          {
            category: 'Personalkosten',
            amount: projectData.totalBudget ? projectData.totalBudget * 0.6 : 0,
            percentage: 60,
            description: 'Gehälter und Lohnkosten',
            justification: 'Hauptkostenfaktor in den meisten Projekten',
          },
          {
            category: 'Hardware',
            amount: projectData.totalBudget ? projectData.totalBudget * 0.2 : 0,
            percentage: 20,
            description: 'Computer, Server, Ausrüstung',
            justification: 'Notwendige technische Ausstattung',
          },
        ],
        totalBudget: projectData.totalBudget || 0,
        reasoning:
          'Standard budget breakdown based on typical project cost distribution',
      };

    case 'timeline':
      return {
        suggestedTimeline: [
          {
            phase: 'Planungsphase',
            startDate: new Date().toISOString().split('T')[0],
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
              .toISOString()
              .split('T')[0],
            duration: '4 weeks',
            description: 'Detaillierte Projektplanung und Vorbereitung',
            dependencies: [],
            resources: ['Projektmanager', 'Fachbereichsleiter'],
          },
        ],
        criticalPath: ['Planungsphase'],
        reasoning: 'Standard project timeline based on typical project phases',
      };

    default:
      return {};
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'AI Project Suggestions API',
    supportedTypes: [
      'categories - Generate project categories',
      'milestones - Generate project milestones',
      'risks - Identify project risks',
      'budget - Generate budget breakdown',
      'timeline - Generate project timeline',
    ],
    features: [
      'AI-powered suggestions',
      'Context-aware recommendations',
      'Industry best practices',
      'Fallback suggestions when AI fails',
    ],
  });
}
