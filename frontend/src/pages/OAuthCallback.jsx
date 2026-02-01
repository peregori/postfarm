import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { oauthApi } from '../api/client';

/**
 * OAuth Callback Page
 * Handles OAuth redirect from Twitter/LinkedIn, exchanges code for tokens
 */
export default function OAuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { platform } = useParams();
  const [status, setStatus] = useState('processing'); // processing, success, error
  const [message, setMessage] = useState('Connecting your account...');
  const hasProcessed = useRef(false); // Prevent double execution in StrictMode

  useEffect(() => {
    const handleCallback = async () => {
      // Prevent double execution (React StrictMode runs useEffect twice)
      if (hasProcessed.current) {
        return;
      }
      hasProcessed.current = true;
      try {
        // Extract OAuth parameters from URL
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const error = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        // Check for OAuth errors
        if (error) {
          setStatus('error');
          setMessage(
            errorDescription || `OAuth error: ${error}. Please try again.`
          );
          setTimeout(() => {
            navigate(`/settings?error=${encodeURIComponent(error)}`);
          }, 2000);
          return;
        }

        // Validate required parameters
        if (!code || !state || !platform) {
          setStatus('error');
          setMessage('Invalid OAuth callback. Missing required parameters.');
          setTimeout(() => {
            navigate('/settings?error=invalid_callback');
          }, 2000);
          return;
        }

        // Exchange code for tokens
        const result = await oauthApi.callback(code, state, platform);

        if (result.success) {
          setStatus('success');
          setMessage(`${platform.charAt(0).toUpperCase() + platform.slice(1)} connected successfully!`);

          // Close popup if opened in popup, otherwise redirect
          if (window.opener) {
            // This is a popup - close it
            window.close();
          } else {
            // Redirect to settings with success message
            setTimeout(() => {
              navigate(`/settings?connected=${platform}`);
            }, 1500);
          }
        } else {
          throw new Error(result.message || 'Failed to connect account');
        }
      } catch (err) {
        console.error('OAuth callback error:', err);
        setStatus('error');
        setMessage(
          err.response?.data?.detail ||
          err.message ||
          'Failed to connect account. Please try again.'
        );

        // Redirect to settings with error after delay
        setTimeout(() => {
          const errorMsg = encodeURIComponent(err.response?.data?.detail || err.message || 'connection_failed');
          if (window.opener) {
            window.close();
          } else {
            navigate(`/settings?error=${errorMsg}`);
          }
        }, 2000);
      }
    };

    handleCallback();
  }, [searchParams, platform, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 shadow-lg rounded-lg p-8">
        <div className="text-center">
          {status === 'processing' && (
            <>
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Connecting your account
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                {message}
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900 mb-4">
                <svg
                  className="w-6 h-6 text-green-600 dark:text-green-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Success!
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                {message}
              </p>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900 mb-4">
                <svg
                  className="w-6 h-6 text-red-600 dark:text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Connection Failed
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                {message}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
