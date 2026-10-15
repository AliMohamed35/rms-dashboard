// Reads the GitHub storage settings from environment variables.
const TOKEN_RE = /(github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{20,})/;
const REPO_RE = /github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:[/?#]|$)/;
const TOKEN_NAMES = ['GITHUB_TOKEN', 'GH_TOKEN', 'GITHUB_PAT', 'GITHUB_ACCESS_TOKEN', 'GITHUB_PERSONAL_ACCESS_TOKEN'];

/**
 * Finds the GitHub token(s) and repo whatever the variables are called (a token, a repo URL, or a URL with the
 * token in it). Every distinct token is returned with the variable it came from, so storage can fall back to
 * another one when the first has no access to the repo.
 */
export function githubConfig(env) {
  const named = (...keys) => keys.map((k) => env[k]).find(Boolean);
  const entries = Object.entries(env).filter(([k]) => !k.startsWith('npm_')).map(([k, v]) => [k, String(v ?? '')]);
  const tokens = [];
  const addToken = (source, value) => {
    const token = value.match(TOKEN_RE)?.[1] || (TOKEN_NAMES.includes(source) ? value.trim() : null);
    if (token && !tokens.some((t) => t.token === token)) tokens.push({ token, source });
  };
  for (const k of TOKEN_NAMES) if (env[k]) addToken(k, String(env[k]));
  for (const [k, v] of entries) if (TOKEN_RE.test(v)) addToken(k, v);

  const repoSource = named('GITHUB_REPO', 'GITHUB_REPO_URL', 'GITHUB_REPOSITORY', 'GITHUB_URL', 'REPO_URL') || entries.map(([, v]) => v).find((v) => REPO_RE.test(v));
  let owner, repo;
  const m = repoSource && (repoSource.match(REPO_RE) || repoSource.trim().match(/^([\w.-]+)\/([\w.-]+?)(?:\.git)?$/));
  if (m) [, owner, repo] = m;
  owner ||= env.VERCEL_GIT_REPO_OWNER; repo ||= env.VERCEL_GIT_REPO_SLUG;   // Vercel's own system variables
  if (!tokens.length || !owner || !repo) return null;
  return { token: tokens[0].token, tokens, owner, repo, branch: env.GITHUB_BRANCH || env.VERCEL_GIT_COMMIT_REF || 'main', path: env.GITHUB_DB_PATH || 'db.json' };
}
