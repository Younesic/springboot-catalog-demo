#!/usr/bin/env node
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

/**
 * Trigger Backstage Scaffolder to create a catalog component PR.
 *
 * Required env vars:
 *   BACKSTAGE_URL              – e.g. https://backstage.example.com
 *   BACKSTAGE_TOKEN            – Bearer token for the Scaffolder API
 *   OWNER_GROUP_REF            – e.g. group:default/team-cib
 *   COMPONENT_NAME             – name of the component (repo name)
 *
 * Optional env vars (metadata from previous CI jobs):
 *   COMPONENT_TYPE             – default "service"
 *   LIFECYCLE                  – default "experimental"
 *   DEPENDENCY_TRACK_PROJECT_ID – UUID from Dependency-Track step
 *   HARBOR_REPOSITORY_SLUG     – e.g. platform/springboot-catalog-demo
 *   IMAGE_REF                  – full image ref e.g. harbor.example.com/platform/repo:sha
 *   ARGOCD_APP_NAME_DEV        – e.g. app-springboot-catalog-demo-dev
 *   ARGOCD_APP_URL_DEV         – e.g. https://argocd.example.com/applications/argocd/app-...-dev
 */

const {
  BACKSTAGE_URL,
  BACKSTAGE_TOKEN,
  OWNER_GROUP_REF,
  COMPONENT_NAME,
  COMPONENT_TYPE = 'service',
  LIFECYCLE = 'experimental',
  DEPENDENCY_TRACK_PROJECT_ID,
  HARBOR_REPOSITORY_SLUG,
  IMAGE_REF,
  ARGOCD_APP_NAME_DEV,
  ARGOCD_APP_URL_DEV,
} = process.env;

// ── validation ───────────────────────────────────────────────
const required = { BACKSTAGE_URL, BACKSTAGE_TOKEN, OWNER_GROUP_REF, COMPONENT_NAME };
for (const [k, v] of Object.entries(required)) {
  if (!v) {
    console.error(`❌  Missing required env var: ${k}`);
    process.exit(1);
  }
}

const baseUrl = BACKSTAGE_URL.replace(/\/+$/, '');

// ── payload ──────────────────────────────────────────────────
const values = {
  repoUrl: 'github.com?owner=Younesic&repo=kratix-statestore',
  targetPath: 'state/platform/cell-platform/backstage/resources/components',
  branchPrefix: 'catalog-editor/create-component',
  componentName: COMPONENT_NAME,
  owner: OWNER_GROUP_REF,
  componentType: COMPONENT_TYPE,
  lifecycle: LIFECYCLE,
  skipOwnerValidation: true,
  // optional descriptive fields
  componentTitle: COMPONENT_NAME,
  description: 'Created automatically from GitHub Actions',
  tags: ['ci', 'catalog', 'demo'],
};

// Inject metadata from previous CI jobs if available
if (DEPENDENCY_TRACK_PROJECT_ID) {
  values.dependencyTrackProjectId = DEPENDENCY_TRACK_PROJECT_ID;
} else {
  values.dependencyTrackProjectId = `dtrack-${COMPONENT_NAME}`;
}

if (HARBOR_REPOSITORY_SLUG) {
  values.harborRepositorySlug = HARBOR_REPOSITORY_SLUG;
} else {
  values.harborRepositorySlug = `platform/${COMPONENT_NAME}`;
}

const payload = {
  templateRef: 'template:default/catalog-component-gitops-v1',
  values,
};

// ── log enriched payload ─────────────────────────────────────
console.log('📦  Enriched Scaffolder payload:');
console.log(`    dependencyTrackProjectId = ${values.dependencyTrackProjectId}`);
console.log(`    harborRepositorySlug     = ${values.harborRepositorySlug}`);
if (IMAGE_REF) console.log(`    imageRef                 = ${IMAGE_REF}`);
if (ARGOCD_APP_NAME_DEV) console.log(`    argocdAppNameDev         = ${ARGOCD_APP_NAME_DEV}`);
if (ARGOCD_APP_URL_DEV) console.log(`    argocdAppUrlDev          = ${ARGOCD_APP_URL_DEV}`);

// ── helpers ──────────────────────────────────────────────────
async function api(path, opts = {}) {
  const url = `${baseUrl}${path}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${BACKSTAGE_TOKEN}`,
      ...opts.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status} ${res.statusText} – ${url}\n${text}`);
  }
  return res.json();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── main ─────────────────────────────────────────────────────
async function main() {
  console.log(`\n🚀  Creating scaffolder task for component "${COMPONENT_NAME}" …`);
  const { id: taskId } = await api('/api/scaffolder/v2/tasks', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  console.log(`📋  Task created: ${taskId}`);

  // Poll for completion
  const POLL_INTERVAL_MS = 5_000;
  const MAX_POLLS = 120; // 10 minutes max
  let status;

  for (let i = 0; i < MAX_POLLS; i++) {
    await sleep(POLL_INTERVAL_MS);
    const task = await api(`/api/scaffolder/v2/tasks/${taskId}`);
    status = task.status;
    console.log(`⏳  Poll ${i + 1}: status = ${status}`);

    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      break;
    }
  }

  if (status === 'failed' || status === 'cancelled') {
    console.error(`❌  Task ${status}.`);
    process.exit(1);
  }

  if (status !== 'completed') {
    console.error('❌  Task did not complete within the timeout window.');
    process.exit(1);
  }

  // Try to extract PR URL from events
  let prUrl = null;
  try {
    const events = await api(`/api/scaffolder/v2/tasks/${taskId}/events`);
    for (const event of events) {
      const links = event?.body?.links ?? [];
      for (const link of links) {
        if (link?.url?.includes('pull')) {
          prUrl = link.url;
          break;
        }
      }
      if (prUrl) break;

      const msg = event?.body?.message ?? '';
      const match = msg.match(/https?:\/\/[^\s]+pull[^\s]*/);
      if (match) {
        prUrl = match[0];
        break;
      }
    }
  } catch {
    console.warn('⚠️  Could not fetch task events – skipping PR URL extraction.');
  }

  // Fallback: try task outputs
  if (!prUrl) {
    try {
      const task = await api(`/api/scaffolder/v2/tasks/${taskId}`);
      const outputs = task?.output ?? {};
      if (outputs.links) {
        for (const link of outputs.links) {
          if (link?.url?.includes('pull')) {
            prUrl = link.url;
            break;
          }
        }
      }
      if (!prUrl && outputs.remoteUrl) {
        prUrl = outputs.remoteUrl;
      }
    } catch {
      // ignore
    }
  }

  if (prUrl) {
    console.log(`✅  Task completed! PR URL: ${prUrl}`);
  } else {
    console.log('✅  Task completed! (no PR URL found in events/outputs)');
  }

  // Verification: log expected catalog-info metadata
  console.log('\n📋  Expected catalog-info.yaml metadata in the PR:');
  console.log('    metadata.annotations:');
  console.log(`      dependencytrack/project-id: "${values.dependencyTrackProjectId}"`);
  console.log(`      goharbor.io/repository-slug: "${values.harborRepositorySlug}"`);
  console.log('    metadata.links:');
  console.log('      - title: GitOps Service');
  if (ARGOCD_APP_URL_DEV) {
    console.log(`      - title: ArgoCD Dev → ${ARGOCD_APP_URL_DEV}`);
  }
}

main().catch((err) => {
  console.error('❌  Fatal error:', err.message ?? err);
  process.exit(1);
});
