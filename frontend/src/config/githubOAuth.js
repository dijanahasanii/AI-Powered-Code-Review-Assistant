import { getPublicApiBaseUrl } from './publicUrls';

/** Server-initiated GitHub OAuth (signed `state`). Pass true to force GitHub's account picker. */
export function githubOAuthStartUrl(switchAccount = false) {
  const base = `${getPublicApiBaseUrl()}/api/auth/github`;
  return switchAccount ? `${base}?switch_account=1` : base;
}
