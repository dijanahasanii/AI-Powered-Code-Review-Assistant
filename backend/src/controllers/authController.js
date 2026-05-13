const axios = require('axios');
const jwt = require('jsonwebtoken');
const { supabase } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const { logger } = require('../utils/logger');
const { createGithubOAuthState, verifyGithubOAuthState } = require('../utils/githubOAuthState');
const {
  primaryFrontendBase,
  browserOrigin,
  allFrontendBaseStrings,
  isDevelopmentRelaxedOrigin,
} = require('../utils/frontendOrigins');

function githubOAuthRedirectUri() {
  return `${primaryFrontendBase(process.env.FRONTEND_URL)}/auth/callback`;
}

/** Must match the redirect_uri GitHub redirected the browser to after login. */
function githubTokenExchangeRedirectUri(queryRedirectUri) {
  const fallback = githubOAuthRedirectUri();

  const raw = typeof queryRedirectUri === 'string' ? queryRedirectUri.trim() : '';
  if (!raw) return fallback;

  let candidate;
  try {
    candidate = new URL(raw);
  } catch {
    return fallback;
  }

  let path = candidate.pathname;
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  if (path !== '/auth/callback') return fallback;

  const candOrigin = candidate.origin;
  let envMatches = false;
  for (const b of allFrontendBaseStrings(process.env.FRONTEND_URL)) {
    if (browserOrigin(b) === candOrigin) {
      envMatches = true;
      break;
    }
  }

  // Keep in sync with CORS / Socket.IO: same dev-only rules as `isAllowedFrontendOrigin`.
  const devMatches = isDevelopmentRelaxedOrigin(
    candOrigin,
    process.env.NODE_ENV,
    process.env.FRONTEND_DEV_EXTRA_ORIGINS
  );

  if (!envMatches && !devMatches) return fallback;

  return `${candOrigin}/auth/callback`;
}

/**
 * Step 1: Redirect user to GitHub OAuth authorization page
 * GET /api/auth/github
 */
const githubRedirect = (req, res, next) => {
  try {
    if (!process.env.GITHUB_CLIENT_ID) {
      throw new AppError('GitHub OAuth not configured (missing GITHUB_CLIENT_ID)', 500);
    }
    const params = new URLSearchParams({
      client_id: process.env.GITHUB_CLIENT_ID,
      redirect_uri: githubOAuthRedirectUri(),
      scope: 'user:email read:user repo admin:repo_hook',
    });
    // RFC 6749 / OAuth 2.0 Security BCP: unpredictable `state` echoed by GitHub mitigates login CSRF
    // (victim tricked into completing an attacker's in-flight OAuth) without a session store — signed opaque blob.
    let state;
    try {
      state = createGithubOAuthState();
    } catch (e) {
      if (e && e.code === 'OAUTH_STATE_CONFIG') {
        throw new AppError('Server misconfiguration: JWT_SECRET required for secure GitHub login', 500);
      }
      throw e;
    }
    params.set('state', state);
    res.redirect(`https://github.com/login/oauth/authorize?${params}`);
  } catch (err) {
    next(err);
  }
};

/**
 * Step 2: Handle OAuth callback, exchange code for access token
 * GET /api/auth/github/callback?code=xxx
 */
const githubCallback = async (req, res, next) => {
  try {
    const { code } = req.query;
    if (!code || typeof code !== 'string' || code.trim() === '') {
      throw new AppError('Authorization code missing or invalid', 400);
    }

    if (!verifyGithubOAuthState(req.query.state)) {
      throw new AppError(
        'Invalid or expired sign-in session — please start GitHub login again from the home page.',
        400
      );
    }

    if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
      throw new AppError('GitHub OAuth credentials not configured', 500);
    }

    const redirectUri = githubTokenExchangeRedirectUri(req.query.redirect_uri);

    let tokenResponse;
    try {
      tokenResponse = await axios.post(
        'https://github.com/login/oauth/access_token',
        {
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code: code.trim(),
          redirect_uri: redirectUri,
        },
        { headers: { Accept: 'application/json' }, timeout: 15000 }
      );
    } catch (axiosErr) {
      logger.error('GitHub token exchange network error:', axiosErr.message);
      throw new AppError('Failed to contact GitHub — please try again', 502);
    }

    const tokenPayload = tokenResponse.data || {};
    if (tokenPayload.error) {
      logger.warn('GitHub token exchange refused', {
        error: tokenPayload.error,
        description: tokenPayload.error_description,
      });
      throw new AppError(
        tokenPayload.error === 'bad_verification_code'
          ? 'OAuth code expired or already used — please log in again'
          : tokenPayload.error_description || tokenPayload.error || 'GitHub OAuth failed',
        400
      );
    }

    const { access_token: githubToken } = tokenPayload;
    if (!githubToken) throw new AppError('Failed to obtain GitHub access token', 400);

    let githubUser;
    try {
      const userResponse = await axios.get('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${githubToken}` },
        timeout: 15000,
      });
      githubUser = userResponse.data;
    } catch (axiosErr) {
      logger.error('Failed to fetch GitHub user profile:', axiosErr.message);
      throw new AppError('Failed to fetch GitHub user profile', 502);
    }

    if (!githubUser || githubUser.id == null) {
      throw new AppError('Invalid GitHub user profile received', 400);
    }

    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
      logger.error('JWT_SECRET is missing or too short');
      throw new AppError('Server misconfiguration', 500);
    }

    const githubId = String(githubUser.id);

    const { error: upsertError } = await supabase.from('users').upsert(
      {
        github_id: githubId,
        username: githubUser.login || '',
        email: githubUser.email ?? null,
        avatar_url: githubUser.avatar_url ?? null,
        access_token: githubToken,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'github_id' }
    );

    if (upsertError) {
      logger.error('Failed to upsert user', {
        message: upsertError.message,
        code: upsertError.code,
        details: upsertError.details,
        hint: upsertError.hint,
      });
      const devDetail =
        process.env.NODE_ENV !== 'production'
          ? `${upsertError.message}${upsertError.hint ? ` — ${upsertError.hint}` : ''}${upsertError.code ? ` [${upsertError.code}]` : ''}`
          : 'Database error during login';
      throw new AppError(devDetail, 500);
    }

    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('id, username, email, avatar_url')
      .eq('github_id', githubId)
      .single();

    if (fetchError || !user) {
      logger.error('Failed to fetch user after upsert', {
        message: fetchError?.message,
        code: fetchError?.code,
        githubId,
      });
      throw new AppError('Database error — could not retrieve user after login', 500);
    }

    // Issue our own JWT
    const appToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });

    res.json({
      success: true,
      token: appToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatarUrl: user.avatar_url,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/auth/me  — return current user profile
 */
const getMe = async (req, res) => {
  res.json({ success: true, user: req.user });
};

module.exports = { githubRedirect, githubCallback, getMe };
