'use client';

import { AlertCircle, Building2, CheckCircle, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface Company {
  id: string;
  name: string;
  description?: string;
  role: string;
}

export default function CompanySetupPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const router = useRouter();

  const handleJoinCompany = async () => {
    if (!selectedCompany) {
      setError('Please select a company to join');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/join-company', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyId: selectedCompany,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to join company');
      }

      // Redirect to dashboard
      router.push('/');
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Failed to join company'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateCompany = () => {
    router.push('/auth/create-company');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-blue-100">
            <Building2 className="h-6 w-6 text-blue-600" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Choose Your Company
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Select a company to join or create a new one
          </p>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-4">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">{error}</h3>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {/* Available Companies */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Available Companies
            </h3>

            {companies.length === 0 ? (
              <div className="text-center py-8">
                <Building2 className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  No companies available
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  You don't have any pending invitations to companies.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {companies.map(company => (
                  <div
                    key={company.id}
                    className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                      selectedCompany === company.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setSelectedCompany(company.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">
                          {company.name}
                        </h4>
                        {company.description && (
                          <p className="text-sm text-gray-500 mt-1">
                            {company.description}
                          </p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          Role: {company.role}
                        </p>
                      </div>
                      {selectedCompany === company.id && (
                        <CheckCircle className="h-5 w-5 text-blue-500" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={handleJoinCompany}
              disabled={!selectedCompany || isLoading}
              className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Joining...' : 'Join Selected Company'}
            </button>

            <button
              onClick={handleCreateCompany}
              className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create New Company
            </button>
          </div>

          {/* Help Text */}
          <div className="text-center">
            <p className="text-sm text-gray-500">
              Need help? Contact your administrator or{' '}
              <a href="/support" className="text-blue-600 hover:text-blue-500">
                support team
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
