#!/usr/bin/env node

/**
 * ArgoCD application health check.
 *
 * Required env vars:
 *   ARGOCD_BASE_URL   – e.g. https://argocd.51-158-65-204.nip.io
 *   ARGOCD_TOKEN      – Bearer token for ArgoCD API
 *   COMPONENT_NAME    – component/repo name used to derive app name
 *
 * Convention:
 *   argocdAppNameDev = app-<componentName>-dev
 *   argocdAppUrlDev  = <ARGOCD_BASE_URL>/applications/argocd/app-<componentName>-dev
 */

import { appendFileSync } from 'node:fs';

const { ARGOCD_BASE_URL, ARGOCD_TOKEN, COMPONENT_NAME } = process.env;

// ── validation ───────────────────────────────────────────────
const required = { ARGOCD_BASE_URL, ARGOCD_TOKEN, COMPONENT_NAME };
for (const [k, v] of Object.entries(required)) {
  if (!v) {
    console.error(`❌  Missing required env var: ${k}`);
    process.exit(1);
  }
}

const baseUrl = ARGOCD_BASE_URL.replace(/\/+$/, '');
const appName = `app-${COMPONENT_NAME}-dev`;
const appUrl = `${baseUrl}/applications/argocd/${appName}`;

// ── main ─────────────────────────────────────────────────────
async function main() {
  console.log(`🔍  Checking ArgoCD app "${appName}" …`);
  console.log(`🔗  App URL: ${appUrl}`);

  const apiUrl = `${baseUrl}/api/v1/applications/${appName}`;
  const res = await fetch(apiUrl, {
    headers: {
      Authorization: `Bearer ${ARGOCD_TOKEN}`,
    },
  });

  if (res.status === 404) {
    console.warn(`⚠️  App "${appName}" not found in ArgoCD (may not be deployed yet).`);
    console.log('ℹ️  Continuing — the app will be created upon first deployment.');
  } else if (!res.ok) {
    const text = await res.text();
    throw new Error(`ArgoCD API ${res.status} ${res.statusText}\n${text}`);
  } else {
    const app = await res.json();
    const health = app?.status?.health?.status ?? 'Unknown';
    const sync = app?.status?.sync?.status ?? 'Unknown';
    console.log(`💚  Health: ${health}  |  Sync: ${sync}`);
  }

  // Output for GitHub Actions
  const ghOutput = process.env.GITHUB_OUTPUT;
  if (ghOutput) {
    appendFileSync(ghOutput, `argocd_app_name_dev=${appName}\n`);
    appendFileSync(ghOutput, `argocd_app_url_dev=${appUrl}\n`);
    console.log(`📝  Written argocd outputs to GITHUB_OUTPUT`);
  }
}

main().catch((err) => {
  console.error('❌  Fatal error:', err.message ?? err);
  process.exit(1);
});
