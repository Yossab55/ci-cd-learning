# 02. Continuous Integration Mechanics: Ephemeral Services, Isolation & Sharding

> **Milestone:** Phase 2 — Continuous Integration (CI)  
> **Status:** Mastered  
> **Draw.io Diagram:** [ci-mechanics.dio](file:///home/yossab/1-Project/CI-CD-learning/concepts/02-continuous-integration/ci-mechanics/ci-mechanics.dio)  
> **Hands-On Lab:** [ci.yml](file:///home/yossab/1-Project/CI-CD-learning/.github/workflows/ci.yml) | [promo-repository.ts](file:///home/yossab/1-Project/CI-CD-learning/labs/01-node-service/src/promo-repository.ts)

---

## 🏛️ 1. Historical Context: Why Mocks Alone Lie About Production

Early CI pipelines only ran fast unit tests with mocked database repositories. While unit tests validate pure domain logic in milliseconds (CPU/RAM only), they fail silently at the **I/O boundary**:
- A SQL `NUMERIC(5,4)` column comes back from `pg` (`node-postgres`) as a JavaScript `string`, not a `number`.
- A `UNIQUE` constraint (`23505`) or `CHECK` constraint (`23514`) never fires against an in-memory mock array.
- Shared staging databases used by multiple PRs suffer from **cross-PR row corruption** ("PR #42 deleted PR #41's seed data").

**The CI Solution:** Spin up **ephemeral, containerized database dependencies** per job (`services: postgres`) on isolated cloud VMs, tear them down automatically when the job finishes, and shard slow suites across parallel runners.

---

## ⚙️ 2. Technical Anatomy of a Production CI Pipeline

```mermaid
flowchart LR
    PR["Push / Pull Request"] --> QG["Job 1: quality-gate (ubuntu-latest)"]
    QG -->|"npm ci + lint + tsc + unit tests"| ART["Upload Artifact (dist/)"]
    ART -->|"needs: quality-gate"| S1["Job 2a: integration-test (Shard 1)"]
    ART -->|"needs: quality-gate"| S2["Job 2b: integration-test (Shard 2)"]
    PG1[("services: postgres:16-alpine<br/>pg_isready health check")] <-->|"localhost:5432"| S1
    PG2[("services: postgres:16-alpine<br/>pg_isready health check")] <-->|"localhost:5432"| S2
```

### A. Fail-Fast Gating & Runner Architecture (`needs:`)
- **Steps share a VM; Jobs share NOTHING.** Each GitHub Actions job provisions a fresh, isolated virtual machine (`ubuntu-latest`).
- By placing `integration-test` behind `needs: quality-gate`, the pipeline refuses to burn runner minutes pulling Docker images or booting PostgreSQL if a 2-second linter, `tsc --noEmit`, or 25ms unit test already failed.
- **Artifact Bridge:** Because `quality-gate` compiles `dist/` on VM #1, `integration-test` VMs use `actions/upload-artifact@v4` / `actions/download-artifact@v4` to reuse the exact compiled bundle rather than trusting cross-VM disk state (which does not exist).

### B. Ephemeral Service Containers & Deterministic Readiness
Starting a Docker container (`docker run`) is **not** equivalent to PostgreSQL being ready for TCP/SQL traffic:
- Postgres still needs to initialize its data directory, replay WAL logs, and bind its listening socket.
- Using `sleep 5` is a classic **CI anti-pattern**: too slow when the container boots in 1.2s, and flaky (`ECONNREFUSED`) when a noisy cloud host slows boot to 7s.
- **The Deterministic Gate:** Use Docker health checks inside `services.postgres.options`:
  ```yaml
  options: >-
    --health-cmd "pg_isready -U ci_user -d pricing_test"
    --health-interval 10s
    --health-timeout 5s
    --health-retries 5
  ```
- **Hermetic Tag Pinning:** Always pin an explicit major version (`postgres:16-alpine`), never `:latest`, so old commits remain reproducible years later.

### C. Host-VM vs. Container Job Networking
Where your test process runs determines how packets cross the Docker network boundary:

| Runner Mode | Where `npm test` Executes | Network Boundary | Connection String |
| :--- | :--- | :--- | :--- |
| **Host Runner** (`runs-on: ubuntu-latest`, no `container:`) | Directly on the Ubuntu Host VM | Host OS is **outside** Docker's internal bridge DNS; requires `ports: ['5432:5432']` | `postgresql://ci_user:ci_password@localhost:5432/pricing_test` |
| **Container Job** (`runs-on: ubuntu-latest` + `container: node:20`) | Inside a `node:20` container | GitHub joins both containers to the **same Docker bridge network** (no `ports:` needed) | `postgresql://ci_user:ci_password@postgres:5432/pricing_test` |

### D. Cross-Test State Isolation (Eliminating Order Dependencies)
Even when each PR and each matrix shard gets its own private Postgres container, tests running sequentially *inside one shard* share that database. If Test 1 inserts `SUMMER20`, Test 2 asserting an empty table will fail unless state is reset:
1. **`beforeEach` Truncation (`TRUNCATE TABLE promos RESTART IDENTITY CASCADE`):** Resets table data pages in $O(1)$-ish time and resets `SERIAL` identity counters before every test — safe even if a prior run crashed before `afterEach`.
2. **Transaction Rollback (`BEGIN` $\to$ Test $\to$ `ROLLBACK`):** Ultra-fast uncommitted test isolation, though tricky if the system under test opens its own nested `BEGIN`/`COMMIT` blocks.

### E. Test Sharding & Parallel Matrix Builds (`strategy.matrix`)
When integration suites grow to 20+ minutes on a single VM:
- Define `strategy.matrix` (e.g., `shard: [1, 2]`) so GitHub provisions parallel VMs simultaneously — each with **its own dedicated `services: postgres` container**.
- **`fail-fast` Trade-Off:** `fail-fast: true` (default) cancels remaining shards immediately on the first failure to save runner minutes. `fail-fast: false` lets every shard finish so the developer receives the complete failure report in a single CI cycle.
- **Tiered Testing:** Pair a fast PR gate (lint + unit + critical integration shards) with heavier nightly/post-merge regression workflows.

---

## 💥 3. Real-World Production Case Study: The "Works With Mocks" Outage

Teams frequently ship bugs where unit tests mock `PromoRepository.createPromo()` returning `{ discountRate: 0.2 }`, while in real PostgreSQL:
- `pg` returns `NUMERIC(5,4)` columns as `"0.2000"` (`string`). Performing `subtotal + row.discount_rate` in JS concatenates strings (`"1000.2000"`) instead of adding numbers!
- A missing `CHECK (discount_rate >= 0 AND discount_rate <= 1)` constraint allows corrupt negative discounts into production.

Running `PromoRepository` against a real ephemeral `postgres:16-alpine` container in CI catches driver serialization quirks, constraint errors (`23505`, `23514`), and SQL syntax bugs on every pull request — before the artifact is ever promoted to CD.

---

## 🧠 4. Socratic Review Quiz

1. Why must CI workflows pass ephemeral test `DATABASE_URL` values via `env:` instead of `env-file: .env`, and why must `postgres` live under `services:` rather than `container:` when the job uses `actions/setup-node` on `ubuntu-latest`?
2. If you run `npm test` directly on `ubuntu-latest` (no `container:`) and connect to `postgres:5432` instead of `localhost:5432`, what exact DNS failure occurs and why?
3. Why is `TRUNCATE` inside `beforeEach` strictly safer than `DELETE` inside `afterEach` for keeping integration tests order-independent?
