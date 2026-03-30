#!/usr/bin/env node

/**
 * Dependency-Track integration:
 *   1. Generate CycloneDX SBOM
 *   2. Create or find the project in Dependency-Track
 *   3. Upload the BOM
 *   4. Output the project UUID
 *
 * Required env vars:
 *   DTRACK_BASE_URL   – e.g. https://dtrack.example.com
 *   DTRACK_API_KEY    – API key with BOM_UPLOAD + PROJECT_CREATION permissions
 *   PROJECT_NAME      – name of the project (component name)
 *   PROJECT_VERSION   – version string (e.g. git sha or semver)
 *   SBOM_PATH         – path to the generated SBOM file (bom.json / bom.xml)
 */

import { readFileSync } from 'node:fs';

const {
  DTRACK_BASE_URL,
  DTRACK_API_KEY,
  PROJECT_NAME,
  PROJECT_VERSION = '1.0.0',
  SBOM_PATH = 'bom.json',
} = process.env;

// ── validation ───────────────────────────────────────────────
const required = { DTRACK_BASE_URL, DTRACK_API_KEY, PROJECT_NAME };
for (const [k, v] of Object.entries(required)) {
  if (!v) {
    console.error(`❌  Missing required env var: ${k}`);
    process.exit(1);
  }
}

const baseUrl = DTRACK_BASE_URL.replace(/\/+$/, '');

// ── helpers ──────────────────────────────────────────────────
async function api(path, opts = {}) {
  const url = `${baseUrl}${path}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      'X-Api-Key': DTRACK_API_KEY,
      ...opts.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DTrack API ${res.status} ${res.statusText} – ${url}\n${text}`);
  }
  const ct = res.headers.get('content-type') || '';
  return ct.includes('json') ? res.json() : res.text();
}

// ── main ─────────────────────────────────────────────────────
async function main() {
  // 1. Find or create the project
  console.log(`🔍  Looking for project "${PROJECT_NAME}" v${PROJECT_VERSION} …`);
  let project = null;

  try {
    const projects = await api(
      `/api/v1/project/lookup?name=${encodeURIComponent(PROJECT_NAME)}&version=${encodeURIComponent(PROJECT_VERSION)}`,
    );
    project = projects;
    console.log(`📦  Found existing project: ${project.uuid}`);
  } catch {
    // project not found – create it
    console.log('📦  Project not found, creating…');
    project = await api('/api/v1/project', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: PROJECT_NAME,
        version: PROJECT_VERSION,
        active: true,
      }),
    });
    console.log(`📦  Created project: ${project.uuid}`);
  }

  // 2. Read and upload SBOM
  console.log(`📄  Reading SBOM from ${SBOM_PATH} …`);
  const sbomContent = readFileSync(SBOM_PATH, 'utf-8');
  const sbomBase64 = Buffer.from(sbomContent).toString('base64');

  console.log('⬆️   Uploading BOM to Dependency-Track…');
  await api('/api/v1/bom', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project: project.uuid,
      bom: sbomBase64,
    }),
  });

  console.log(`✅  BOM uploaded successfully.`);
  console.log(`📋  Project UUID: ${project.uuid}`);

  // Output for GitHub Actions
  const ghOutput = process.env.GITHUB_OUTPUT;
  if (ghOutput) {
    const { appendFileSync } = await import('node:fs');
    appendFileSync(ghOutput, `dependency_track_project_id=${project.uuid}\n`);
    console.log(`📝  Written dependency_track_project_id to GITHUB_OUTPUT`);
  }
}

main().catch((err) => {
  console.error('❌  Fatal error:', err.message ?? err);
  process.exit(1);
});
