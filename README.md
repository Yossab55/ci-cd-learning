# CI/CD Engineering Mastery & Pipeline Sandbox 🚀

Welcome to the **CI/CD Learning Hub** — a comprehensive, hands-on repository dedicated to mastering **Continuous Integration (CI)** and **Continuous Delivery / Deployment (CD)** from first principles to cloud-native production pipelines.

> *"If it hurts, do it more often, and bring the pain forward."*  
> — Jez Humble & David Farley (*Continuous Delivery*)

---

## 🧭 Mission & Philosophy

Modern software engineering is not just about writing code; it is about **delivering value to users reliably, safely, and repeatedly with zero friction**. 

This hub is designed to take us from:
1. **The Historical Pain & Roots**: Why software used to take 6 months to deploy ("Merge Hell", snowflake servers, late integration).
2. **Continuous Integration Mechanics**: Fast feedback loops, trunk-based development, automated testing pyramids, runners, and build orchestration.
3. **Continuous Delivery vs Continuous Deployment**: Artifact management, immutability, release gates, and environmental parity.
4. **Advanced Deployment Topologies**: Rolling updates, Blue/Green zero-downtime cutovers, Canary analysis, and Feature Flags.
5. **DevSecOps & Supply Chain Integrity**: SAST, DAST, dependency analysis, container scanning, and cryptographic signing (SBOM / Sigstore).
6. **GitOps & Declarative Reconcilers**: Modern Kubernetes delivery engines (ArgoCD / Flux).

---

## 🗂️ Repository Architecture

```
CI-CD-learning/
├── AGENTS.md                  # Autonomous agent governance, mentor rules, and learning ledger
├── README.md                  # Project overview and curriculum navigation
├── session.md                 # Persistent progress log across development sessions
├── concepts/                  # Deep architectural breakdowns, theory & Draw.io diagrams
│   ├── 01-fundamentals/       # Why CI/CD exists, historical problems & DORA metrics
│   ├── 02-continuous-integration/ # Merge mechanics, build systems, test automation
│   ├── 03-continuous-delivery/    # Artifacts, immutability, environment promotion
│   ├── 04-deployment-strategies/  # Blue/Green, Canary, Rolling, Feature Flags
│   └── 05-devsecops/          # Security scanning, supply chain, SBOM
├── pipelines/                 # Practical, runnable pipeline configurations
│   ├── github-actions/        # Real GitHub Actions workflows
│   └── gitlab-ci/             # Real GitLab CI/CD pipelines
└── labs/                      # Sample microservices & testbeds to run pipelines against
```

---

## 📚 Core References & Primary Literature

- [GitLab CI/CD Guide](https://about.gitlab.com/topics/ci-cd/) — Automated workflows, runners, and DevOps unification.
- [The New Stack: A Primer on CI/CD](https://thenewstack.io/a-primer-continuous-integration-and-continuous-delivery-ci-cd/) — Left-to-right flow, small batch sizes, and reducing handoffs.
- *Continuous Delivery: Reliable Software Releases through Build, Test, and Deployment Automation* — Jez Humble & David Farley.
- *Accelerate: The Science of Lean Software and DevOps* — Nicole Forsgren, Jez Humble, and Gene Kim (DORA Research).

---

## 👥 Roles & Mentorship

- **Learner:** Yossab
- **Primary Mentor:** `my-mentor` (Universal Senior Mentor & Advisor)
- **Session Coordinator:** `close-session`
