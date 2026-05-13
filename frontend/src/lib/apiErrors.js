/**
 * Turns axios-style errors into user-facing titles and recovery hints.
 * Keeps logic centralized so pages stay readable.
 */

function pickApiString(data) {
  if (!data || typeof data !== 'object') return null;
  if (typeof data.error === 'string' && data.error.trim()) return data.error.trim();
  if (typeof data.message === 'string' && data.message.trim()) return data.message.trim();
  if (Array.isArray(data.errors) && data.errors[0]?.msg) return String(data.errors[0].msg);
  return null;
}

function appearsOffline() {
  if (typeof navigator === 'undefined') return false;
  return navigator.onLine === false;
}

/** True for repo/review routes that often fail when the stored GitHub token is stale (not /api/auth/*). */
function isGithubBackedResourceRequest(err) {
  const raw = err?.config?.url;
  if (typeof raw !== 'string') return false;
  const path = raw.includes('/api/') ? raw.slice(raw.indexOf('/api')) : raw;
  if (path.startsWith('/api/auth/')) return false;
  if (path.startsWith('/api/repos')) return true;
  if (path.startsWith('/api/reviews')) return true;
  return false;
}

function webhookHintFromMessage(msg) {
  if (typeof msg !== 'string') return null;
  const m = msg.toLowerCase();
  if (
    m.includes('webhook') ||
    m.includes('signature') ||
    m.includes('x-hub-signature') ||
    m.includes('hmac')
  ) {
    return {
      title: 'GitHub webhook validation failed',
      detail:
        'GitHub could not verify the webhook secret, or your callback URL is unreachable. Confirm GITHUB_WEBHOOK_SECRET and BACKEND_URL in backend/.env, then use “Install webhook” on Repositories.',
    };
  }
  if (m.includes('rate limit') || m.includes('secondary rate limit')) {
    return {
      title: 'GitHub rate limit',
      detail:
        'GitHub temporarily throttled this request. Wait a minute and retry, or reduce parallel automation while developing.',
    };
  }
  if (m.includes('bad credentials') || m.includes('401')) {
    return {
      title: 'GitHub authorization issue',
      detail:
        'The access token may be expired or missing scopes. Sign out, reconnect GitHub from the home screen, and try again.',
    };
  }
  return null;
}

/**
 * @param {unknown} error — typically an axios error
 * @param {{ resourceLabel?: string }}} [opts]
 * @returns {{ title: string; detail: string; canRetry: boolean }}
 */
export function describeApiFailure(error, opts = {}) {
  const resource = opts.resourceLabel || 'this data';

  if (error == null) {
    return {
      title: 'Request failed',
      detail: `We could not load ${resource}. Try again in a moment.`,
      canRetry: true,
    };
  }

  if (!error.response) {
    const msg = typeof error.message === 'string' ? error.message : '';
    const looksAborted = /abort|cancell?ed/i.test(msg);
    if (looksAborted) {
      return {
        title: 'Request cancelled',
        detail: 'The request was interrupted before the server responded.',
        canRetry: false,
      };
    }
    if (appearsOffline()) {
      return {
        title: 'No internet connection detected.',
        detail: 'Reconnect and try again.',
        canRetry: true,
      };
    }
    const msgLower = msg.toLowerCase();
    if (msgLower.includes('timeout') || error.code === 'ECONNABORTED') {
      return {
        title: 'Request timed out',
        detail:
          'The server or GitHub took too long to answer. Try again in a moment or check backend logs.',
        canRetry: true,
      };
    }
    return {
      title: 'Network error',
      detail:
        'No response from the server. Check your connection, VPN, and that the backend is running.',
      canRetry: true,
    };
  }

  const { status, data } = error.response;
  const apiMsg = pickApiString(data);
  const hinted = apiMsg ? webhookHintFromMessage(apiMsg) : null;
  if (hinted) {
    return { title: hinted.title, detail: hinted.detail, canRetry: true };
  }

  if (status === 404) {
    return {
      title: 'Not found',
      detail: apiMsg || `We could not find ${resource}. It may have been removed.`,
      canRetry: false,
    };
  }

  if (status === 401 || status === 403) {
    if (isGithubBackedResourceRequest(error)) {
      return {
        title: 'GitHub or session access problem',
        detail:
          apiMsg ||
          (status === 401
            ? 'Your app session or stored GitHub token may be invalid or expired. Sign out, sign in again with GitHub from the home page, then retry. Org repos need the same OAuth scopes you granted at login.'
            : 'GitHub denied this action (permissions, token, or repository visibility). Confirm you still have access to the repo and required scopes; sign out and sign in again if your token was revoked.'),
        canRetry: status === 401,
      };
    }
    return {
      title: status === 401 ? 'Sign-in required' : 'Access denied',
      detail:
        apiMsg ||
        (status === 401
          ? 'Your session may have expired. Sign in again from the home page.'
          : 'Your account is not allowed to perform this action.'),
      canRetry: status === 401,
    };
  }

  if (status === 422) {
    return {
      title: 'Request could not be processed',
      detail: apiMsg || 'The server rejected the payload. Check inputs and try again.',
      canRetry: false,
    };
  }

  if (status >= 500) {
    return {
      title: 'Server error',
      detail:
        apiMsg ||
        'The API returned an error. Check backend logs for the failing route, then retry.',
      canRetry: true,
    };
  }

  return {
    title: 'Could not complete request',
    detail: apiMsg || `Something went wrong loading ${resource} (HTTP ${status}).`,
    canRetry: true,
  };
}
