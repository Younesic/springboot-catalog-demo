#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DEFAULT_TEMPLATE_REF = 'template:default/catalog-component-gitops-v1';
const DEFAULT_REPO_URL = 'github.com?owner=Younesic&repo=portal-catalog-components';
const DEFAULT_TARGET_PATH = 'components';
const DEFAULT_BRANCH_PREFIX = 'catalog-editor/create-component';
const DEFAULT_COMPONENT_TYPE = 'service';
const DEFAULT_COMPONENT_LIFECYCLE = 'experimental';
const DEFAULT_TIMEOUT_SECONDS = 900;
const DEFAULT_POLL_INTERVAL_MS = 4000;
const DEFAULT_ALLOW_UNAUTH_FALLBACK = true;
const DEFAULT_SKIP_OWNER_VALIDATION = true;

const sleep = ms => new Promise(resolvePromise => setTimeout(resolvePromise, ms));

const firstNonEmpty = (...values) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
};

const normalizeComponentName = rawValue => {
  const normalized = rawValue.trim().toLowerCase();
  if (!/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(normalized)) {
    throw new Error(
      `Invalid component name '${rawValue}'. Expected [a-z0-9]([-a-z0-9]*[a-z0-9])?.`,
    );
  }
  return normalized;
};

const sanitizePackageName = packageName => {
  const withoutScope = packageName.includes('/')
    ? packageName.split('/').pop()
    : packageName;
  if (!withoutScope) {
    return undefined;
  }
  const normalized = withoutScope
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || undefined;
};

const canonicalizeOwnerGroupRef = rawValue => {
  const value = rawValue.trim().toLowerCase();
  if (!value) {
    return undefined;
  }
  if (value.startsWith('group:')) {
    const match = value.match(/^group:([a-z0-9._-]+)\/([a-z0-9][a-z0-9._-]*)$/);
    return match ? `group:${match[1]}/${match[2]}` : undefined;
  }
  if (value.includes('/')) {
    return canonicalizeOwnerGroupRef(`group:${value}`);
  }
  return canonicalizeOwnerGroupRef(`group:default/${value}`);
};

const parseCsv = rawValue => {
  if (!rawValue || !rawValue.trim()) {
    return undefined;
  }
  const values = rawValue
    .split(',')
    .map(token => token.trim())
    .filter(Boolean);
  return values.length > 0 ? values : undefined;
};

const readPackageJson = cwd => {
  const path = resolve(cwd, 'package.json');
  if (!existsSync(path)) {
    return undefined;
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return undefined;
  }
};

const readPomXml = cwd => {
  const path = resolve(cwd, 'pom.xml');
  if (!existsSync(path)) {
    return undefined;
  }
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return undefined;
  }
};

const extractPomTag = (pomXml, tag) => {
  const pattern = new RegExp(`<${tag}>([^<]+)</${tag}>`, 'i');
  const match = pomXml.match(pattern);
  if (!match?.[1]) {
    return undefined;
  }
  return match[1].trim();
};

const resolveOwnerGroupRef = cwd => {
  const envOwner = firstNonEmpty(
    process.env.OWNER_GROUP_REF,
    process.env.CATALOG_OWNER_GROUP_REF,
    process.env.OWNER_GROUP,
  );
  if (envOwner) {
    const canonical = canonicalizeOwnerGroupRef(envOwner);
    if (!canonical) {
      throw new Error(`Invalid owner group '${envOwner}'.`);
    }
    return canonical;
  }

  const teamSlug = firstNonEmpty(process.env.TEAM_SLUG, process.env.CATALOG_TEAM_SLUG);
  if (teamSlug) {
    const normalizedTeam = teamSlug
      .toLowerCase()
      .replace(/^team-/, '')
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (!normalizedTeam) {
      throw new Error(`Invalid TEAM_SLUG '${teamSlug}'.`);
    }
    return `group:default/team-${normalizedTeam}`;
  }

  const packageJson = readPackageJson(cwd);
  if (packageJson && typeof packageJson === 'object') {
    const backstage = packageJson.backstage || {};
    const ownerCandidate = firstNonEmpty(
      backstage.ownerGroupRef,
      backstage.ownerGroup,
      backstage.owner,
      packageJson.ownerGroupRef,
      packageJson.ownerGroup,
      packageJson.owner,
    );
    if (ownerCandidate) {
      const canonical = canonicalizeOwnerGroupRef(ownerCandidate);
      if (!canonical) {
        throw new Error(`Invalid owner group in package.json: '${ownerCandidate}'.`);
      }
      return canonical;
    }
  }

  const pomXml = readPomXml(cwd);
  if (pomXml) {
    const ownerCandidate = firstNonEmpty(
      extractPomTag(pomXml, 'backstage.ownerGroupRef'),
      extractPomTag(pomXml, 'backstage.ownerGroup'),
      extractPomTag(pomXml, 'backstage.owner'),
      extractPomTag(pomXml, 'ownerGroupRef'),
      extractPomTag(pomXml, 'ownerGroup'),
    );
    if (ownerCandidate) {
      const canonical = canonicalizeOwnerGroupRef(ownerCandidate);
      if (!canonical) {
        throw new Error(`Invalid owner group in pom.xml: '${ownerCandidate}'.`);
      }
      return canonical;
    }
  }

  throw new Error(
    'Owner group not found. Provide OWNER_GROUP_REF / TEAM_SLUG, or set package.json.backstage.ownerGroup (or pom.xml backstage.ownerGroup).',
  );
};

const resolveComponentName = cwd => {
  const envComponentName = firstNonEmpty(
    process.env.COMPONENT_NAME,
    process.env.CATALOG_COMPONENT_NAME,
  );
  if (envComponentName) {
    return normalizeComponentName(envComponentName);
  }

  const packageJson = readPackageJson(cwd);
  if (packageJson && typeof packageJson === 'object') {
    const backstage = packageJson.backstage || {};
    const candidate = firstNonEmpty(backstage.componentName, packageJson.name);
    if (candidate) {
      const normalized = sanitizePackageName(candidate);
      if (normalized) {
        return normalizeComponentName(normalized);
      }
    }
  }

  const pomXml = readPomXml(cwd);
  if (pomXml) {
    const artifactId = extractPomTag(pomXml, 'artifactId');
    if (artifactId) {
      const normalized = sanitizePackageName(artifactId);
      if (normalized) {
        return normalizeComponentName(normalized);
      }
    }
  }

  throw new Error(
    'Component name not found. Provide COMPONENT_NAME, or set package.json.name / pom.xml artifactId.',
  );
};

const normalizeBackstageToken = rawToken => {
  if (!rawToken || typeof rawToken !== 'string') {
    return '';
  }
  const trimmed = rawToken.trim().replace(/^['"]|['"]$/g, '');
  if (!trimmed) {
    return '';
  }
  return trimmed.replace(/^Bearer\s+/i, '').trim();
};

const toHeaders = token => {
  const headers = { 'Content-Type': 'application/json' };
  if (token && token.trim()) {
    headers.Authorization = `Bearer ${token.trim()}`;
  }
  return headers;
};

const parseBooleanEnv = (value, defaultValue) => {
  if (typeof value !== 'string' || !value.trim()) {
    return defaultValue;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
    return true;
  }
  if (normalized === 'false' || normalized === '0' || normalized === 'no') {
    return false;
  }
  return defaultValue;
};

const looksLikeIllegalTokenError = payloadText =>
  /illegal token|could not resolve credentials|authenticationerror/i.test(
    payloadText || '',
  );

const fetchWithAuthFallback = async ({
  url,
  method = 'GET',
  token,
  body,
  allowUnauthFallback,
}) => {
  const headers = toHeaders(token);
  const response = await fetch(url, {
    method,
    headers,
    body,
  });
  if (!allowUnauthFallback || !token) {
    return { response, usedToken: Boolean(token), payloadText: undefined };
  }
  if (response.status !== 401) {
    return { response, usedToken: true, payloadText: undefined };
  }

  const payloadText = await response.text();
  if (!looksLikeIllegalTokenError(payloadText)) {
    return { response, usedToken: true, payloadText };
  }

  const retry = await fetch(url, {
    method,
    headers: toHeaders(''),
    body,
  });
  return { response: retry, usedToken: false, payloadText };
};

const componentExistsInCatalog = async ({
  backstageUrl,
  backstageToken,
  componentName,
  allowUnauthFallback,
}) => {
  const { response, usedToken, payloadText } = await fetchWithAuthFallback({
    url: `${backstageUrl}/api/catalog/entities/by-name/component/default/${encodeURIComponent(
      componentName,
    )}`,
    method: 'GET',
    token: backstageToken,
    allowUnauthFallback,
  });

  if (response.status === 404) {
    return false;
  }
  if (response.ok) {
    if (!usedToken && backstageToken) {
      console.log(
        '[catalog-ci] provided BACKSTAGE_TOKEN was rejected; fallback to unauthenticated request succeeded.',
      );
    }
    return true;
  }

  const payload = payloadText ?? (await response.text());
  throw new Error(
    `Unable to check component existence in catalog: ${payload || response.statusText}`,
  );
};

const readTaskOutput = taskPayload => {
  if (!taskPayload || typeof taskPayload !== 'object') {
    return {};
  }
  if (taskPayload.output && typeof taskPayload.output === 'object') {
    return taskPayload.output;
  }
  if (taskPayload.task && typeof taskPayload.task === 'object') {
    const nested = taskPayload.task.output;
    if (nested && typeof nested === 'object') {
      return nested;
    }
  }
  return {};
};

const extractPrUrlFromOutput = output => {
  if (!output || typeof output !== 'object') {
    return undefined;
  }
  const links = output.links;
  if (!Array.isArray(links)) {
    return undefined;
  }
  const pullRequestLink = links.find(
    link =>
      typeof link?.title === 'string' &&
      /pull request/i.test(link.title) &&
      typeof link?.url === 'string' &&
      link.url.trim(),
  );
  if (pullRequestLink?.url?.trim()) {
    return pullRequestLink.url.trim();
  }
  const inferredFromAnyLink = links.find(
    link =>
      typeof link?.url === 'string' &&
      /\/pull\/\d+/i.test(link.url.trim()),
  );
  return inferredFromAnyLink?.url?.trim();
};

const extractFirstPullUrl = value => {
  if (!value) {
    return undefined;
  }
  if (typeof value === 'string') {
    return /https?:\/\/[^"'\s]+\/pull\/\d+/i.test(value) ? value : undefined;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const match = extractFirstPullUrl(entry);
      if (match) {
        return match;
      }
    }
    return undefined;
  }
  if (typeof value === 'object') {
    for (const entry of Object.values(value)) {
      const match = extractFirstPullUrl(entry);
      if (match) {
        return match;
      }
    }
  }
  return undefined;
};

const extractPrUrlFromEvents = eventsPayload => {
  if (!Array.isArray(eventsPayload)) {
    return undefined;
  }
  for (let index = eventsPayload.length - 1; index >= 0; index -= 1) {
    const event = eventsPayload[index];
    const completionOutput = event?.body?.output;
    const fromOutput = extractPrUrlFromOutput(completionOutput);
    if (fromOutput) {
      return fromOutput;
    }
    const fromEventBody = extractFirstPullUrl(event?.body);
    if (fromEventBody) {
      return fromEventBody;
    }
  }
  return undefined;
};

const main = async () => {
  const cwd = process.cwd();
  const backstageUrl = (
    process.env.BACKSTAGE_URL || 'http://localhost:7007'
  ).replace(/\/+$/, '');
  const backstageToken = normalizeBackstageToken(process.env.BACKSTAGE_TOKEN || '');
  const templateRef = process.env.CATALOG_TEMPLATE_REF || DEFAULT_TEMPLATE_REF;
  const timeoutSeconds = Number(
    process.env.TASK_TIMEOUT_SECONDS || DEFAULT_TIMEOUT_SECONDS,
  );
  const pollIntervalMs = Number(
    process.env.TASK_POLL_INTERVAL_MS || DEFAULT_POLL_INTERVAL_MS,
  );
  const waitForCompletion =
    (process.env.WAIT_FOR_COMPLETION || 'true').trim().toLowerCase() !== 'false';
  const allowUnauthFallback = parseBooleanEnv(
    process.env.BACKSTAGE_ALLOW_UNAUTH_FALLBACK,
    DEFAULT_ALLOW_UNAUTH_FALLBACK,
  );
  const skipOwnerValidation = parseBooleanEnv(
    process.env.CATALOG_SKIP_OWNER_VALIDATION,
    DEFAULT_SKIP_OWNER_VALIDATION,
  );

  if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0) {
    throw new Error('TASK_TIMEOUT_SECONDS must be a positive number.');
  }
  if (!Number.isFinite(pollIntervalMs) || pollIntervalMs <= 0) {
    throw new Error('TASK_POLL_INTERVAL_MS must be a positive number.');
  }

  const componentName = resolveComponentName(cwd);
  const ownerGroupRef = resolveOwnerGroupRef(cwd);

  const values = {
    repoUrl: process.env.CATALOG_REPO_URL || DEFAULT_REPO_URL,
    targetPath: process.env.CATALOG_TARGET_PATH || DEFAULT_TARGET_PATH,
    branchPrefix: process.env.CATALOG_BRANCH_PREFIX || DEFAULT_BRANCH_PREFIX,
    componentName,
    owner: ownerGroupRef,
    componentTitle: firstNonEmpty(process.env.COMPONENT_TITLE),
    description: firstNonEmpty(process.env.COMPONENT_DESCRIPTION),
    componentType:
      firstNonEmpty(process.env.COMPONENT_TYPE) || DEFAULT_COMPONENT_TYPE,
    lifecycle:
      firstNonEmpty(process.env.COMPONENT_LIFECYCLE) ||
      DEFAULT_COMPONENT_LIFECYCLE,
    system: firstNonEmpty(process.env.SYSTEM_REF, process.env.COMPONENT_SYSTEM_REF),
    dependsOn: parseCsv(process.env.CATALOG_DEPENDS_ON),
    providesApis: parseCsv(process.env.CATALOG_PROVIDES_APIS),
    consumesApis: parseCsv(process.env.CATALOG_CONSUMES_APIS),
    tags: parseCsv(process.env.CATALOG_TAGS),
    dependencyTrackProjectId: firstNonEmpty(process.env.DEPENDENCY_TRACK_PROJECT_ID),
    harborRepositorySlug: firstNonEmpty(process.env.HARBOR_REPOSITORY_SLUG),
    skipOwnerValidation,
  };

  const filteredValues = Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined),
  );

  const exists = await componentExistsInCatalog({
    backstageUrl,
    backstageToken,
    componentName,
    allowUnauthFallback,
  });
  if (exists) {
    console.log(
      `[catalog-ci] component 'component:default/${componentName}' already exists -> no PR created.`,
    );
    return;
  }

  const createBody = JSON.stringify({
    templateRef,
    values: filteredValues,
  });
  const {
    response: createResponse,
    usedToken: createUsedToken,
    payloadText: createPayloadText,
  } = await fetchWithAuthFallback({
    url: `${backstageUrl}/api/scaffolder/v2/tasks`,
    method: 'POST',
    token: backstageToken,
    body: createBody,
    allowUnauthFallback,
  });
  if (!createResponse.ok) {
    const payload = createPayloadText ?? (await createResponse.text());
    throw new Error(
      `Unable to start scaffolder task: ${payload || createResponse.statusText}`,
    );
  }
  if (!createUsedToken && backstageToken) {
    console.log(
      '[catalog-ci] provided BACKSTAGE_TOKEN was rejected; task creation used unauthenticated fallback.',
    );
  }
  const createPayload = await createResponse.json();
  const taskId =
    typeof createPayload?.id === 'string' && createPayload.id.trim()
      ? createPayload.id.trim()
      : undefined;
  if (!taskId) {
    throw new Error('Scaffolder response did not include task id.');
  }

  console.log(`[catalog-ci] task started: ${taskId}`);
  console.log(`[catalog-ci] task url: ${backstageUrl}/create/tasks/${taskId}`);

  if (!waitForCompletion) {
    return;
  }

  const startedAt = Date.now();
  let finalTask;
  while (Date.now() - startedAt < timeoutSeconds * 1000) {
    const { response: taskResponse } = await fetchWithAuthFallback({
      url: `${backstageUrl}/api/scaffolder/v2/tasks/${taskId}`,
      method: 'GET',
      token: backstageToken,
      allowUnauthFallback,
    });
    if (!taskResponse.ok) {
      const payload = await taskResponse.text();
      throw new Error(
        `Unable to read task '${taskId}': ${payload || taskResponse.statusText}`,
      );
    }
    const taskPayload = await taskResponse.json();
    const status = String(taskPayload?.status || '').toLowerCase();
    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      finalTask = taskPayload;
      break;
    }
    await sleep(pollIntervalMs);
  }

  if (!finalTask) {
    throw new Error(`Task '${taskId}' timed out after ${timeoutSeconds} seconds.`);
  }

  const status = String(finalTask.status || '').toLowerCase();
  if (status !== 'completed') {
    throw new Error(`Task '${taskId}' ended with status '${status}'.`);
  }

  const output = readTaskOutput(finalTask);
  let prUrl = extractPrUrlFromOutput(output);
  if (!prUrl) {
    prUrl = extractFirstPullUrl(finalTask?.state);
  }
  if (!prUrl) {
    const { response: eventsResponse } = await fetchWithAuthFallback({
      url: `${backstageUrl}/api/scaffolder/v2/tasks/${taskId}/events`,
      method: 'GET',
      token: backstageToken,
      allowUnauthFallback,
    });
    if (eventsResponse.ok) {
      const eventsPayload = await eventsResponse.json();
      prUrl = extractPrUrlFromEvents(eventsPayload);
    }
  }
  if (prUrl) {
    console.log(`[catalog-ci] pull request: ${prUrl}`);
  } else {
    console.log(
      '[catalog-ci] task completed (PR link not returned by task payload).',
    );
  }
};

main().catch(error => {
  console.error(`[catalog-ci][error] ${(error && error.message) || String(error)}`);
  process.exitCode = 1;
});
