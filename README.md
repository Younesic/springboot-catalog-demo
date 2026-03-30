# springboot-catalog-demo

Minimal Spring Boot 3 application for testing GitHub Actions CI + Backstage Catalog integration.

## Prerequisites

- Java 17+
- Maven (wrapper included)

## Run

```bash
./mvnw spring-boot:run
```

The app starts on http://localhost:8080. Try:

```bash
curl http://localhost:8080/api/hello
```

## Test

```bash
./mvnw test
```

## CI / Backstage

The GitHub Actions workflow (`.github/workflows/ci.yml`):
1. **build-and-test** – compiles and runs tests on every push.
2. **catalog** – on `main` only, calls the Backstage Scaffolder to create a catalog component PR.

### Required GitHub Secrets

| Secret | Description |
|---|---|
| `BACKSTAGE_URL` | Backstage instance URL |
| `BACKSTAGE_TOKEN` | Backstage API token |
| `OWNER_GROUP_REF` | Owner group ref, e.g. `group:default/team-cib` |
