# Versioning & releases (beginner-friendly)

This doc explains how to start using **Git + GitHub + Vercel** and how to do **versions/releases** safely.

## Key idea (most important)

- You can make **many commits** while still on the **same version**.
- You only bump the version when you decide “this is a release milestone”.

Git commits are like small save points; releases are like named milestones.

---

## 0. Definitions (quick)

- **Commit**: a snapshot of changes (you do this often).
- **Branch**: a line of work (e.g. `main`, `feature/sound-effects`).
- **Tag**: a label for a specific commit (e.g. `v0.3.0`).
- **Release**: a published tag + notes (GitHub Releases UI).
- **SemVer**: version format `MAJOR.MINOR.PATCH` (e.g. `1.4.2`).
- **Changelog**: human-readable list of changes per release.

---

## 1. Recommended version scheme for you

Start pre-1.0 with **0.x.y**:

- **Patch**: `0.2.3 → 0.2.4`  
  Fixes, small UI tweaks, tiny improvements.
- **Minor**: `0.2.4 → 0.3.0`  
  New features/sections, new persona polish, new pages.
- **Major**: `0.3.0 → 1.0.0` (later)  
  Your “public stable launch” milestone.

For most portfolios, you’ll do **patch** and **minor** often, and only do **1.0.0** once you’re confident.

---

## 2. Do I need to “version every commit”?

**No.**  
Typical workflow:

- Many commits happen under the same version.
- When you’re ready to publish a milestone, you bump version + tag it.

So yes, you can do:

- 20 commits while still at `0.1.0`
- then bump to `0.2.0` when you finish “Contact + Deploy”

---

## 3. How GitHub “versions” your code

GitHub does **not** automatically version your project.

What it stores:

- commit history
- tags (if you create them)
- releases (if you publish them)

If you want official versions like `v0.2.0`, you create **tags** (manually or via `npm version`).

---

## 4. One-time setup (recommended)

### 4.1 Initialize Git repo at `Portfolio/` root

Run from `Portfolio/`:

```bash
git init
git add .
git commit -m "chore: initial project setup"
```

### 4.2 Create GitHub repo and push

1. Create a new repo on GitHub (web UI).
2. Then link and push:

```bash
git remote add origin <YOUR_GITHUB_REPO_URL>
git branch -M main
git push -u origin main
```

### 4.3 Connect Vercel

- Import the GitHub repo into Vercel
- In Vercel settings, set **Root Directory** to `portfolio-site`
- Deploy

---

## 5. Day-to-day workflow (what you do before each commit)

### Minimum (good enough)

1. Make changes
2. Run:

```bash
cd portfolio-site
npm run lint
```

3. Commit:

```bash
git add .
git commit -m "feat: add new section"
```

### Recommended commit message style

Use “Conventional-ish” messages (helps later automation):

- `feat: ...` new feature
- `fix: ...` bug fix
- `docs: ...` documentation change
- `refactor: ...` no behavior change
- `chore: ...` tooling / maintenance

This is optional now, but extremely helpful later if we automate releases.

---

## 6. How to create a release version (manual but safe)

### 6.1 Update changelog notes first

Create/update `CHANGELOG.md` (we’ll add this file when you want) and write:

- what you added
- what you changed
- what you fixed

### 6.2 Bump the version number

Run from `portfolio-site/`:

```bash
npm version patch -m "chore(release): %s"
```

or:

```bash
npm version minor -m "chore(release): %s"
```

or:

```bash
npm version major -m "chore(release): %s"
```

What this does (when you’re in a Git repo):

- updates `portfolio-site/package.json` version
- creates a **git commit**
- creates a **git tag** like `v0.2.0`

### 6.3 Push commit + tags to GitHub

```bash
git push
git push --tags
```

Now GitHub has the tag and you have an official version.

---

## 7. GitHub Releases (optional)

After tags exist, you can publish a release on GitHub:

- Go to GitHub → Releases → “Draft a new release”
- Choose tag `v0.2.0`
- Paste notes (usually from `CHANGELOG.md`)

This is optional, but nice for a clean history.

---

## 8. Can it be automated?

Yes—two levels:

### Level 1: Easy automation (recommended first)

- Use `npm version patch|minor|major` (semi-automatic)
- Maintain `CHANGELOG.md` manually

### Level 2: Full automation (later)

Use a CI workflow (GitHub Actions) + rules:

- **semantic-release** (versions derived from commit messages)
- auto-generate changelog
- auto-publish GitHub release

This is great once you’re comfortable, but it’s overkill for the first few releases.

---

## 9. FAQ

### Q: If I forget to bump version, is it a problem?
No. Your site still deploys fine. Versioning is for *you* and for clean milestones.

### Q: Will Vercel deploy on every commit?
Usually yes (if connected to GitHub), and that’s good:
- every push can create a preview
- `main` updates production (configurable)

### Q: Can I release without changing code?
You can, but it’s not useful. Best practice: release when a meaningful set of changes is ready.

