// Reads the GitHub storage settings from environment variables.
const TOKEN_RE = /(github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{20,})/;
const REPO_RE = /github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:[/?#]|$)/;

/** Finds the GitHub token and repo whatever the variables are called (a token, a repo URL, or a URL with the token in it). */
export function githubConfig(env) {
  const named = (...keys) => keys.map((k) => env[k]).find(Boolean);
  const values = Object.entries(env).filter(([k]) => !k.startsWith('npm_')).map(([, v]) => String(v ?? ''));
  const tokenSource = named('GITHUB_TOKEN', 'GH_TOKEN', 'GITHUB_PAT', 'GITHUB_ACCESS_TOKEN', 'GITHUB_PERSONAL_ACCESS_TOKEN') || values.find((v) => TOKEN_RE.test(v));
  const token = tokenSource && (tokenSource.match(TOKEN_RE)?.[1] || tokenSource.trim());
  const repoSource = named('GITHUB_REPO', 'GITHUB_REPO_URL', 'GITHUB_REPOSITORY', 'GITHUB_URL', 'REPO_URL') || values.find((v) => REPO_RE.test(v));
  let owner, repo;
  const m = repoSource && (repoSource.match(REPO_RE) || repoSource.trim().match(/^([\w.-]+)\/([\w.-]+?)(?:\.git)?$/));
  if (m) [, owner, repo] = m;
  owner ||= env.VERCEL_GIT_REPO_OWNER; repo ||= env.VERCEL_GIT_REPO_SLUG;   // Vercel's own system variables
  if (!token || !owner || !repo) return null;
  return { token, owner, repo, branch: env.GITHUB_BRANCH || env.VERCEL_GIT_COMMIT_REF || 'main', path: env.GITHUB_DB_PATH || 'db.json' };
}
