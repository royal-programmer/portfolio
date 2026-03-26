# Portfolio workspace documentation

Central documentation for the **Ratul Roy** multi-persona portfolio project. The runnable Next.js app lives in the sibling folder [`../portfolio-site/`](../portfolio-site/).

## Document index

| Doc | Description |
|-----|-------------|
| [01-objectives.md](./01-objectives.md) | Goals, audience, and success criteria |
| [02-technologies.md](./02-technologies.md) | Stack, versions, and key libraries |
| [03-todo-and-checklist.md](./03-todo-and-checklist.md) | Backlog and **implementation checklist** (done vs planned) |
| [04-deployment.md](./04-deployment.md) | Hosting, env vars, and release checklist |
| [05-other-important-documentation.md](./05-other-important-documentation.md) | Architecture notes, persona rules, assets, glossary, gaps |
| [06-versioning-and-releases.md](./06-versioning-and-releases.md) | How to commit, tag, bump versions, and publish releases |

## Workspace layout

```
Portfolio/
├── docs/                 ← you are here (documentation only)
├── portfolio-site/       ← Next.js application (do not treat docs as part of the bundle)
└── (optional) assets/    ← future: local images, brand files
```

## Conventions

- **Filenames:** `NN-topic-in-kebab-case.md` — two-digit prefix enforces reading order in file explorers.
- **App vs docs:** Keep marketing and planning docs here; keep code-adjacent notes (e.g. inline README in `portfolio-site/`) minimal unless duplicated intentionally.
