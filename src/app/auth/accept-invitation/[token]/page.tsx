'use client';

import { AlertCircle, Building2, CheckCircle, XCircle } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface Invitation {
  id: string;
  email: string;
  role: string;
  company: {
    id: string;
    name: string;
  };
  status: string;
  expiresAt: string;
}

export default function AcceptInvitationPage({
  params,
}: {
  params: { token: string };
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (status === 'loading') return;

    fetchInvitation();
  }, [status]);

  const fetchInvitation = async () => {
    try {
      const response = await fetch(`/api/invitations/${params.token}`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Invalid invitation');
      }
      const data = await response.json();
      setInvitation(data.invitation);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Failed to load invitation'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcceptInvitation = async () => {
    if (!session?.user) {
      // Redirect to sign in with callback
      const callbackUrl = `/auth/accept-invitation/${params.token}`;
      router.push(
        `/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`
      );
      return;
    }

    setIsAccepting(true);
    setError('');

    try {
      const response = await fetch(`/api/invitations/${params.token}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: session.user.id,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to accept invitation');
      }

      setSuccess(true);

      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        router.push('/');
      }, 2000);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Failed to accept invitation'
      );
    } finally {
      setIsAccepting(false);
    }
  };

  const handleDeclineInvitation = async () => {
    try {
      const response = await fetch(`/api/invitations/${params.token}/decline`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to decline invitation');
      }

      router.push('/auth/signin');
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Failed to decline invitation'
      );
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-red-100">
              <XCircle className="h-6 w-6 text-red-600" />
            </div>
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
              Invalid Invitation
            </h2>
            <p className="mt-2 text-sm text-gray-600">{error}</p>
          </div>
          <div className="mt-8">
            <button
              onClick={() => router.push('/auth/signin')}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Go to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
              Invitation Accepted!
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              You have successfully joined {invitation?.company.name}.
              Redirecting to dashboard...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!invitation) {
    return null;
  }

  const isExpired = new Date(invitation.expiresAt) < new Date();
  const isAlreadyAccepted = invitation.status === 'ACCEPTED';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-blue-100">
            <Building2 className="h-6 w-6 text-blue-600" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Company Invitation
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            You've been invited to join a company
          </p>
        </div>

        {isExpired && (
          <div className="rounded-md bg-red-50 p-4">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  Invitation Expired
                </h3>
                <p className="mt-1 text-sm text-red-700">
                  This invitation has expired. Please contact the company
                  administrator for a new invitation.
                </p>
              </div>
            </div>
          </div>
        )}

        {isAlreadyAccepted && (
          <div className="rounded-md bg-yellow-50 p-4">
            <div className="flex">
              <CheckCircle className="h-5 w-5 text-yellow-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  Already Accepted
                </h3>
                <p className="mt-1 text-sm text-yellow-700">
                  You have already accepted this invitation.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                Invitation Details
              </h3>
              <dl className="mt-2 space-y-2">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Company</dt>
                  <dd className="text-sm text-gray-900">
                    {invitation.company.name}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Email</dt>
                  <dd className="text-sm text-gray-900">{invitation.email}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Role</dt>
                  <dd className="text-sm text-gray-900 capitalize">
                    {invitation.role.toLowerCase()}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Expires</dt>
                  <dd className="text-sm text-gray-900">
                    {new Date(invitation.expiresAt).toLocaleDateString()}
                  </dd>
                </div>
              </dl>
            </div>

            {!isExpired && !isAlreadyAccepted && (
              <div className="flex space-x-3">
                <button
                  onClick={handleAcceptInvitation}
                  disabled={isAccepting}
                  className="flex-1 flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isAccepting ? 'Accepting...' : 'Accept Invitation'}
                </button>
                <button
                  onClick={handleDeclineInvitation}
                  className="flex-1 flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Decline
                </button>
              </div>
            )}

            {isExpired && (
              <div className="text-center">
                <button
                  onClick={() => router.push('/auth/signin')}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Go to Sign In
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
