#!/bin/sh
# Maven Wrapper script – downloads Maven if not present, then runs it.
# Simplified version; for production use the full wrapper from maven-wrapper project.

set -e

MAVEN_WRAPPER_PROPERTIES="$(dirname "$0")/.mvn/wrapper/maven-wrapper.properties"
MAVEN_HOME="${HOME}/.m2/wrapper"

if [ -f "$MAVEN_WRAPPER_PROPERTIES" ]; then
  DIST_URL=$(grep 'distributionUrl' "$MAVEN_WRAPPER_PROPERTIES" | cut -d'=' -f2-)
fi

DIST_URL="${DIST_URL:-https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/3.9.6/apache-maven-3.9.6-bin.zip}"
MAVEN_VERSION=$(echo "$DIST_URL" | sed 's/.*apache-maven-\([0-9.]*\).*/\1/')
MVN_DIR="${MAVEN_HOME}/dists/apache-maven-${MAVEN_VERSION}"

if [ ! -f "${MVN_DIR}/bin/mvn" ]; then
  echo "Downloading Maven ${MAVEN_VERSION}…"
  mkdir -p "${MAVEN_HOME}/dists"
  TMP_ZIP=$(mktemp /tmp/maven-XXXXXX.zip)
  if command -v curl > /dev/null 2>&1; then
    curl -fsSL -o "$TMP_ZIP" "$DIST_URL"
  elif command -v wget > /dev/null 2>&1; then
    wget -q -O "$TMP_ZIP" "$DIST_URL"
  else
    echo "Error: curl or wget required" >&2; exit 1
  fi
  unzip -qo "$TMP_ZIP" -d "${MAVEN_HOME}/dists"
  rm -f "$TMP_ZIP"
fi

exec "${MVN_DIR}/bin/mvn" "$@"
