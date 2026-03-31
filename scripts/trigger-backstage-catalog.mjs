#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DEFAULT_TEMPLATE_REF = 'template:default/catalog-component-gitops-v1';
const DEFAULT_SERVICE_CONFIG_TEMPLATE_REF =
  'template:default/service-config-control-plane-v3';
const DEFAULT_REPO_URL = 'github.com?owner=Younesic&repo=portal-catalog-components';
const DEFAULT_TARGET_PATH = 'components';
const DEFAULT_BRANCH_PREFIX = 'catalog-editor/create-component';
const DEFAULT_COMPONENT_TYPE = 'service';
const DEFAULT_COMPONENT_LIFECYCLE = 'experimental';
const DEFAULT_SERVICE_CONFIG_DB_CONNECT_TIMEOUT_SECONDS = 15;
const DEFAULT_SERVICE_CONFIG_DB_SSL_MODE = 'disable';
const DEFAULT_SERVICE_CONFIG_CACHE_ENABLED = true;
const DEFAULT_SERVICE_CONFIG_PROD_LOG_LEVEL = 'INFO';
const DEFAULT_SERVICE_CONFIG_GITOPS_BRANCH = 'main';
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

const isPlainObject = value =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const normalizeString = rawValue => {
  if (typeof rawValue !== 'string' || !rawValue.trim()) {
    return undefined;
  }
  return rawValue.trim();
};

const normalizeProdLogLevel = rawValue => {
  const normalized = normalizeString(rawValue)?.toUpperCase();
  if (!normalized) {
    return undefined;
  }
  if (normalized === 'INFO' || normalized === 'WARN' || normalized === 'ERROR') {
    return normalized;
  }
  throw new Error(
    `Invalid SERVICE_CONFIG_PROD_LOG_LEVEL '${rawValue}'. Expected INFO, WARN, or ERROR.`,
  );
};

const normalizeDbSslMode = rawValue => {
  const normalized = normalizeString(rawValue)?.toLowerCase();
  if (!normalized) {
    return undefined;
  }
  if (
    normalized === 'disable' ||
    normalized === 'require' ||
    normalized === 'verify-ca' ||
    normalized === 'verify-full'
  ) {
    return normalized;
  }
  throw new Error(
    `Invalid SERVICE_CONFIG_DB_SSL_MODE '${rawValue}'. Expected disable, require, verify-ca, or verify-full.`,
  );
};

const parseRepoUrl = rawValue => {
  if (typeof rawValue !== 'string' || !rawValue.trim()) {
    return null;
  }

  const trimmed = rawValue.trim();
  const [host, queryString = ''] = trimmed.split('?', 2);
  if (!host || !queryString) {
    return null;
  }

  const query = new URLSearchParams(queryString);
  const owner = firstNonEmpty(query.get('owner'));
  const repo = firstNonEmpty(query.get('repo'));
  if (!owner || !repo) {
    return null;
  }

  return {
    host,
    owner,
    repo,
  };
};

const buildGithubTreeUrl = (repoUrl, branch, targetPath) => {
  const parsed = parseRepoUrl(repoUrl);
  const normalizedBranch = firstNonEmpty(branch);
  const normalizedTargetPath = firstNonEmpty(targetPath)?.replace(/^\/+/, '');
  if (!parsed || !normalizedBranch || !normalizedTargetPath) {
    return undefined;
  }
  if (parsed.host !== 'github.com') {
    return undefined;
  }
  return `https://github.com/${parsed.owner}/${parsed.repo}/tree/${normalizedBranch}/${normalizedTargetPath}`;
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

const readPackageComponentContract = cwd => {
  const packageJson = readPackageJson(cwd);
  if (!isPlainObject(packageJson)) {
    return {
      packageJson: undefined,
      backstage: {},
      component: {},
    };
  }

  const backstage = isPlainObject(packageJson.backstage) ? packageJson.backstage : {};
  const component = isPlainObject(backstage.component) ? backstage.component : {};

  return {
    packageJson,
    backstage,
    component,
  };
};

const extractPomTag = (pomXml, tag) => {
  const pattern = new RegExp(`<${tag}>([^<]+)</${tag}>`, 'i');
  const match = pomXml.match(pattern);
  if (!match?.[1]) {
    return undefined;
  }
  return match[1].trim();
};

const readPomComponentContract = cwd => {
  const pomXml = readPomXml(cwd);
  if (!pomXml) {
    return {
      pomXml: undefined,
      component: {},
    };
  }

  return {
    pomXml,
    component: {
      name: extractPomTag(pomXml, 'backstage.component.name'),
      ref: extractPomTag(pomXml, 'backstage.component.ref'),
      owner: extractPomTag(pomXml, 'backstage.component.owner'),
      type: extractPomTag(pomXml, 'backstage.component.type'),
      lifecycle: extractPomTag(pomXml, 'backstage.component.lifecycle'),
    },
  };
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

  const packageContract = readPackageComponentContract(cwd);
  if (packageContract.packageJson) {
    const ownerCandidate = firstNonEmpty(
      packageContract.component.owner,
      packageContract.component.ownerGroupRef,
      packageContract.component.ownerGroup,
      packageContract.backstage.ownerGroupRef,
      packageContract.backstage.ownerGroup,
      packageContract.backstage.owner,
      packageContract.packageJson.ownerGroupRef,
      packageContract.packageJson.ownerGroup,
      packageContract.packageJson.owner,
    );
    if (ownerCandidate) {
      const canonical = canonicalizeOwnerGroupRef(ownerCandidate);
      if (!canonical) {
        throw new Error(`Invalid owner group in package.json: '${ownerCandidate}'.`);
      }
      return canonical;
    }
  }

  const pomContract = readPomComponentContract(cwd);
  if (pomContract.pomXml) {
    const ownerCandidate = firstNonEmpty(
      pomContract.component.owner,
      extractPomTag(pomContract.pomXml, 'backstage.ownerGroupRef'),
      extractPomTag(pomContract.pomXml, 'backstage.ownerGroup'),
      extractPomTag(pomContract.pomXml, 'backstage.owner'),
      extractPomTag(pomContract.pomXml, 'ownerGroupRef'),
      extractPomTag(pomContract.pomXml, 'ownerGroup'),
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

  const packageContract = readPackageComponentContract(cwd);
  if (packageContract.packageJson) {
    const candidate = firstNonEmpty(
      packageContract.component.name,
      packageContract.backstage.componentName,
      packageContract.packageJson.name,
    );
    if (candidate) {
      const normalized = sanitizePackageName(candidate);
      if (normalized) {
        return normalizeComponentName(normalized);
      }
    }
  }

  const pomContract = readPomComponentContract(cwd);
  if (pomContract.pomXml) {
    const artifactId = firstNonEmpty(
      pomContract.component.name,
      extractPomTag(pomContract.pomXml, 'artifactId'),
    );
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

const resolveComponentType = cwd =>
  firstNonEmpty(
    process.env.COMPONENT_TYPE,
    readPackageComponentContract(cwd).component.type,
    readPomComponentContract(cwd).component.type,
  ) || DEFAULT_COMPONENT_TYPE;

const resolveComponentLifecycle = cwd =>
  firstNonEmpty(
    process.env.COMPONENT_LIFECYCLE,
    readPackageComponentContract(cwd).component.lifecycle,
    readPomComponentContract(cwd).component.lifecycle,
  ) || DEFAULT_COMPONENT_LIFECYCLE;

const resolveComponentRef = (cwd, componentName) =>
  firstNonEmpty(
    process.env.COMPONENT_REF,
    readPackageComponentContract(cwd).component.ref,
    readPomComponentContract(cwd).component.ref,
  ) || `component:default/${componentName}`;

const hasStructuredBootstrapContract = cwd =>
  Boolean(
    firstNonEmpty(
      readPackageComponentContract(cwd).component.name,
      readPackageComponentContract(cwd).component.ref,
      readPomComponentContract(cwd).component.name,
      readPomComponentContract(cwd).component.ref,
    ),
  );

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
  componentRef,
  allowUnauthFallback,
}) => {
  const componentRefMatch = String(componentRef || '').match(
    /^(?<kind>[^:]+):(?<namespace>[^/]+)\/(?<name>.+)$/,
  );
  const kind = componentRefMatch?.groups?.kind || 'component';
  const namespace = componentRefMatch?.groups?.namespace || 'default';
  const name = componentRefMatch?.groups?.name || componentRef;
  const { response, usedToken, payloadText } = await fetchWithAuthFallback({
    url: `${backstageUrl}/api/catalog/entities/by-name/${encodeURIComponent(
      kind,
    )}/${encodeURIComponent(namespace)}/${encodeURIComponent(
      name,
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

const startScaffolderTask = async ({
  backstageUrl,
  backstageToken,
  templateRef,
  values,
  allowUnauthFallback,
  label,
}) => {
  const createBody = JSON.stringify({
    templateRef,
    values,
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
      `Unable to start ${label} scaffolder task: ${payload || createResponse.statusText}`,
    );
  }

  if (!createUsedToken && backstageToken) {
    console.log(
      `[catalog-ci] provided BACKSTAGE_TOKEN was rejected; ${label} task creation used unauthenticated fallback.`,
    );
  }

  const createPayload = await createResponse.json();
  const taskId =
    typeof createPayload?.id === 'string' && createPayload.id.trim()
      ? createPayload.id.trim()
      : undefined;
  if (!taskId) {
    throw new Error(`${label} scaffolder response did not include task id.`);
  }

  console.log(`[catalog-ci] ${label} task started: ${taskId}`);
  console.log(`[catalog-ci] ${label} task url: ${backstageUrl}/create/tasks/${taskId}`);

  return taskId;
};

const waitForTaskCompletion = async ({
  backstageUrl,
  backstageToken,
  taskId,
  timeoutSeconds,
  pollIntervalMs,
  allowUnauthFallback,
  label,
}) => {
  const startedAt = Date.now();
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
        `Unable to read ${label} task '${taskId}': ${payload || taskResponse.statusText}`,
      );
    }
    const taskPayload = await taskResponse.json();
    const status = String(taskPayload?.status || '').toLowerCase();
    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      return taskPayload;
    }
    await sleep(pollIntervalMs);
  }

  throw new Error(`${label} task '${taskId}' timed out after ${timeoutSeconds} seconds.`);
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

const runScaffolderTask = async ({
  backstageUrl,
  backstageToken,
  templateRef,
  values,
  allowUnauthFallback,
  timeoutSeconds,
  pollIntervalMs,
  waitForCompletion,
  label,
}) => {
  const taskId = await startScaffolderTask({
    backstageUrl,
    backstageToken,
    templateRef,
    values,
    allowUnauthFallback,
    label,
  });

  if (!waitForCompletion) {
    return { taskId };
  }

  const finalTask = await waitForTaskCompletion({
    backstageUrl,
    backstageToken,
    taskId,
    timeoutSeconds,
    pollIntervalMs,
    allowUnauthFallback,
    label,
  });

  const status = String(finalTask.status || '').toLowerCase();
  if (status !== 'completed') {
    throw new Error(`${label} task '${taskId}' ended with status '${status}'.`);
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
    console.log(`[catalog-ci] ${label} pull request: ${prUrl}`);
  } else {
    console.log(
      `[catalog-ci] ${label} task completed (PR link not returned by task payload).`,
    );
  }

  return {
    taskId,
    prUrl,
  };
};

const main = async () => {
  const cwd = process.cwd();
  const backstageUrl = (
    process.env.BACKSTAGE_URL || 'http://localhost:7007'
  ).replace(/\/+$/, '');
  const backstageToken = normalizeBackstageToken(process.env.BACKSTAGE_TOKEN || '');
  const catalogTemplateRef = process.env.CATALOG_TEMPLATE_REF || DEFAULT_TEMPLATE_REF;
  const serviceConfigTemplateRef =
    process.env.SERVICE_CONFIG_TEMPLATE_REF || DEFAULT_SERVICE_CONFIG_TEMPLATE_REF;
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
  const componentRef = resolveComponentRef(cwd, componentName);
  const ownerGroupRef = resolveOwnerGroupRef(cwd);
  const componentType = resolveComponentType(cwd);
  const lifecycle = resolveComponentLifecycle(cwd);
  const structuredBootstrapContract = hasStructuredBootstrapContract(cwd);
  const serviceConfigBootstrapEnabled = parseBooleanEnv(
    process.env.SERVICE_CONFIG_BOOTSTRAP_ENABLED,
    structuredBootstrapContract,
  );
  const serviceConfigDbHost =
    firstNonEmpty(process.env.SERVICE_CONFIG_DB_HOST) ||
    `${componentName}-db.dev.internal`;
  const serviceConfigGitopsRepoUrl = firstNonEmpty(
    process.env.SERVICE_CONFIG_GITOPS_REPO_URL,
    process.env.GITOPS_REPO_URL,
  );
  const serviceConfigGitopsBranch =
    firstNonEmpty(
      process.env.SERVICE_CONFIG_GITOPS_BRANCH,
      process.env.GITOPS_BRANCH,
    ) || DEFAULT_SERVICE_CONFIG_GITOPS_BRANCH;
  const serviceConfigGitopsTargetPath =
    firstNonEmpty(
      process.env.SERVICE_CONFIG_GITOPS_TARGET_PATH,
      process.env.GITOPS_TARGET_PATH,
    ) || `services/${componentName}`;
  const serviceConfigCacheEnabled = parseBooleanEnv(
    process.env.SERVICE_CONFIG_CACHE_ENABLED,
    DEFAULT_SERVICE_CONFIG_CACHE_ENABLED,
  );
  const serviceConfigProdLogLevel =
    normalizeProdLogLevel(process.env.SERVICE_CONFIG_PROD_LOG_LEVEL) ||
    DEFAULT_SERVICE_CONFIG_PROD_LOG_LEVEL;
  const serviceConfigDbSslMode =
    normalizeDbSslMode(process.env.SERVICE_CONFIG_DB_SSL_MODE) ||
    DEFAULT_SERVICE_CONFIG_DB_SSL_MODE;
  const serviceConfigDbConnectTimeoutSeconds = Number(
    firstNonEmpty(process.env.SERVICE_CONFIG_DB_CONNECT_TIMEOUT_SECONDS) ||
      DEFAULT_SERVICE_CONFIG_DB_CONNECT_TIMEOUT_SECONDS,
  );

  if (
    !Number.isFinite(serviceConfigDbConnectTimeoutSeconds) ||
    serviceConfigDbConnectTimeoutSeconds <= 0
  ) {
    throw new Error(
      'SERVICE_CONFIG_DB_CONNECT_TIMEOUT_SECONDS must be a positive number.',
    );
  }

  if (serviceConfigBootstrapEnabled && !serviceConfigGitopsRepoUrl) {
    throw new Error(
      'SERVICE_CONFIG_GITOPS_REPO_URL (or GITOPS_REPO_URL) is required when service-config bootstrap is enabled.',
    );
  }

  const values = {
    repoUrl: process.env.CATALOG_REPO_URL || DEFAULT_REPO_URL,
    targetPath: process.env.CATALOG_TARGET_PATH || DEFAULT_TARGET_PATH,
    branchPrefix: process.env.CATALOG_BRANCH_PREFIX || DEFAULT_BRANCH_PREFIX,
    componentName,
    owner: ownerGroupRef,
    componentTitle: firstNonEmpty(process.env.COMPONENT_TITLE),
    description: firstNonEmpty(process.env.COMPONENT_DESCRIPTION),
    componentType,
    lifecycle,
    system: firstNonEmpty(process.env.SYSTEM_REF, process.env.COMPONENT_SYSTEM_REF),
    dependsOn: parseCsv(process.env.CATALOG_DEPENDS_ON),
    providesApis: parseCsv(process.env.CATALOG_PROVIDES_APIS),
    consumesApis: parseCsv(process.env.CATALOG_CONSUMES_APIS),
    tags: parseCsv(process.env.CATALOG_TAGS),
    dependencyTrackProjectId: firstNonEmpty(process.env.DEPENDENCY_TRACK_PROJECT_ID),
    harborRepositorySlug: firstNonEmpty(process.env.HARBOR_REPOSITORY_SLUG),
    gitopsRepoUrl: serviceConfigGitopsRepoUrl,
    gitopsBranch: serviceConfigGitopsBranch,
    gitopsTargetPath: serviceConfigGitopsTargetPath,
    gitopsServiceUrl: buildGithubTreeUrl(
      serviceConfigGitopsRepoUrl,
      serviceConfigGitopsBranch,
      serviceConfigGitopsTargetPath,
    ),
    skipOwnerValidation,
  };

  const filteredValues = Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined),
  );

  const exists = await componentExistsInCatalog({
    backstageUrl,
    backstageToken,
    componentRef,
    allowUnauthFallback,
  });

  if (exists) {
    console.log(
      `[catalog-ci] component '${componentRef}' already exists -> no PR created.`,
    );
  } else {
    await runScaffolderTask({
      backstageUrl,
      backstageToken,
      templateRef: catalogTemplateRef,
      values: filteredValues,
      allowUnauthFallback,
      timeoutSeconds,
      pollIntervalMs,
      waitForCompletion,
      label: 'catalog',
    });
  }

  if (!serviceConfigBootstrapEnabled) {
    console.log(
      '[catalog-ci] service-config bootstrap skipped: no structured backstage.component contract detected.',
    );
    return;
  }

  const serviceConfigValues = {
    target: {
      mode: 'bootstrap-ci',
      bootstrapServiceName: componentName,
      bootstrapComponentRef: componentRef,
      bootstrapGitopsRepoUrl: serviceConfigGitopsRepoUrl,
      bootstrapGitopsRepoBranch: serviceConfigGitopsBranch,
      bootstrapGitopsTargetPath: serviceConfigGitopsTargetPath,
    },
    database: {
      enabled: true,
      dbHost: serviceConfigDbHost,
      dbConnectTimeoutSeconds: serviceConfigDbConnectTimeoutSeconds,
      dbSslMode: serviceConfigDbSslMode,
    },
    cache: {
      enabled: true,
      cacheEnabled: serviceConfigCacheEnabled,
    },
    observability: {
      enabled: true,
      prodLogLevel: serviceConfigProdLogLevel,
    },
  };

  await runScaffolderTask({
    backstageUrl,
    backstageToken,
    templateRef: serviceConfigTemplateRef,
    values: serviceConfigValues,
    allowUnauthFallback,
    timeoutSeconds,
    pollIntervalMs,
    waitForCompletion,
    label: 'service-config',
  });
};

main().catch(error => {
  console.error(`[catalog-ci][error] ${(error && error.message) || String(error)}`);
  process.exitCode = 1;
});
