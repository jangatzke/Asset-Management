import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { authApi } from '../services/api';

type Mode = 'login' | 'register';

const loginShellClass = 'min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900';
const loginCardClass = 'max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 border border-transparent dark:border-gray-700';
const loginTitleClass = 'text-2xl font-bold text-gray-900 dark:text-white';
const loginTextClass = 'text-gray-600 dark:text-gray-300';
const loginLabelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';
const loginInputClass = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:focus:ring-primary-400 dark:focus:border-primary-400';
const loginErrorClass = 'bg-red-100 dark:bg-red-900/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 p-3 rounded mb-4';

const Login = () => {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaToken, setMfaToken] = useState('');
  const [mfaChallenge, setMfaChallenge] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [needsFirstAdmin, setNeedsFirstAdmin] = useState(false);
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const setUser = useAuthStore((state) => state.setUser);

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const res = await authApi.hasAdmin();
        setNeedsFirstAdmin(!res.data.hasAdmin);
      } catch {
        // If the endpoint fails, default to normal login
        setNeedsFirstAdmin(false);
      } finally {
        setLoading(false);
      }
    };
    checkAdmin();
  }, []);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    try {
      if (needsFirstAdmin) {
        // Create first admin
        await authApi.createFirstAdmin({ email, password, firstName, lastName });
        await login(email, password);
        navigate('/');
      } else if (mode === 'login') {
        if (mfaChallenge) {
          const response = await authApi.verifyMfaLogin(mfaChallenge, mfaToken);
          setUser(response.data.user, response.data.token);
        } else {
          const result = await login(email, password);
          if (result?.mfaRequired && result.challenge) {
            setMfaChallenge(result.challenge);
            return;
          }
        }
        navigate('/');
      } else {
        await authApi.register({ email, password, firstName, lastName });
        await login(email, password);
        navigate('/');
      }
    } catch (err: unknown) {
      const maybeError = err as { response?: { data?: { error?: { message?: string }; message?: string } } };
      setError(maybeError.response?.data?.error?.message || maybeError.response?.data?.message || 'Request failed');
    }
  };

  if (loading) {
    return (
      <div className={loginShellClass}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className={`mt-4 ${loginTextClass}`}>Loading...</p>
        </div>
      </div>
    );
  }

  if (needsFirstAdmin) {
    return (
      <div className={loginShellClass}>
        <div className={loginCardClass}>
          <div className="text-center mb-8">
            <h1 className={loginTitleClass}>ISMS Asset Manager</h1>
            <p className={`${loginTextClass} mt-2`}>Create the first administrator account</p>
            <div className="mt-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-200 px-3 py-2 rounded text-sm">
              This will create the initial admin account. After this, all new users will be managed by administrators.
            </div>
          </div>
          <form onSubmit={handleSubmit}>
            {error && (
              <div className={loginErrorClass}>
                {error}
              </div>
            )}
            <div className="mb-4">
              <label htmlFor="firstName" className={loginLabelClass}>
                First Name
              </label>
              <input
                type="text"
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={loginInputClass}
                placeholder="First name"
                required
              />
            </div>
            <div className="mb-4">
              <label htmlFor="lastName" className={loginLabelClass}>
                Last Name
              </label>
              <input
                type="text"
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={loginInputClass}
                placeholder="Last name"
                required
              />
            </div>
            <div className="mb-4">
              <label htmlFor="email" className={loginLabelClass}>
                Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={loginInputClass}
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="mb-6">
              <label htmlFor="password" className={loginLabelClass}>
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={loginInputClass}
                placeholder="Password"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full bg-primary-600 text-white py-2 px-4 rounded-md hover:bg-primary-700 transition"
            >
              Create Admin Account
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className={loginShellClass}>
      <div className={loginCardClass}>
        <div className="text-center mb-8">
          <h1 className={loginTitleClass}>ISMS Asset Manager</h1>
          <p className={`${loginTextClass} mt-2`}>
            {mode === 'login' ? 'Sign in to your account' : 'Create your account'}
          </p>
        </div>
        <form onSubmit={handleSubmit}>
          {error && (
            <div className={loginErrorClass}>
              {error}
            </div>
          )}
          {mode === 'register' && (
            <>
              <div className="mb-4">
                <label htmlFor="firstName" className={loginLabelClass}>
                  First Name
                </label>
                <input
                  type="text"
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={loginInputClass}
                  placeholder="First name"
                  required
                />
              </div>
              <div className="mb-4">
                <label htmlFor="lastName" className={loginLabelClass}>
                  Last Name
                </label>
                <input
                  type="text"
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className={loginInputClass}
                  placeholder="Last name"
                  required
                />
              </div>
            </>
          )}
          <div className="mb-4">
            <label htmlFor="email" className={loginLabelClass}>
              Email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={loginInputClass}
              placeholder="you@example.com"
              required
            />
          </div>
          <div className="mb-6">
            <label htmlFor="password" className={loginLabelClass}>
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={loginInputClass}
              placeholder="Password"
              required
            />
          </div>
          {mfaChallenge && (
            <div className="mb-6">
              <label htmlFor="mfaToken" className={loginLabelClass}>Authenticator code</label>
              <input
                type="text"
                id="mfaToken"
                value={mfaToken}
                onChange={(e) => setMfaToken(e.target.value)}
                className={loginInputClass}
                placeholder="123456"
                inputMode="numeric"
                required
              />
            </div>
          )}
          <button
            type="submit"
            className="w-full bg-primary-600 text-white py-2 px-4 rounded-md hover:bg-primary-700 transition"
          >
            {mfaChallenge ? 'Verify code' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
        <div className="mt-4 text-center">
          <button
            type="button"
            className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError('');
            }}
          >
            {mode === 'login' ? "Don't have an account? Register" : 'Already have an account? Sign In'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
