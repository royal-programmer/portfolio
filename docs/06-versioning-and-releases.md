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

This section is your **initial setup**. You only do it once per computer/repo.

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

### 4.4 First version (initial release)

Your first release is usually **`v0.1.0`**.

Checklist:

1. Ensure the site builds/lints:

```bash
cd portfolio-site
npm run lint
npm run build
```

2. Update `CHANGELOG.md` at repo root (`Portfolio/CHANGELOG.md`):
   - Move completed items from **Unreleased** into a new `0.1.0` section.
3. Commit the changelog:

```bash
cd ..
git add CHANGELOG.md
git commit -m "docs: add changelog for v0.1.0"
```

4. Create and push a tag:

```bash
git tag -a v0.1.0 -m "v0.1.0"
git push
git push --tags
```

That’s it—GitHub now has a real version tag.

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

## 6. Recurring releases (patch / minor / major)

This is what you do **every time you want a new version** (e.g. `v0.1.1`, `v0.2.0`, `v1.0.0`).

### 6.0 When do I choose patch vs minor vs major?

- **Patch** (`x.y.Z`): bug fixes, small UI polish, copy fixes, tiny performance tweaks  
  Example: “Fix theme outline in light mode”, “Improve panel contrast”
- **Minor** (`x.Y.0`): new user-facing features that don’t “break” your site  
  Example: “Add contact form”, “Add trading journal page”, “Add gallery lightbox”
- **Major** (`X.0.0`): big breaking changes / “public stable launch”  
  Example: major redesign, route removals, or you consider the portfolio stable enough for `1.0.0`

### 6.1 Make your changes (many commits are OK)

You can do as many commits as you want before releasing:

```bash
git add .
git commit -m "feat: add contact section"
git commit -m "fix: improve contrast on light theme"
```

Only release when you decide a milestone is ready.

### 6.2 Update the changelog (every release)

Rules:

- Keep an **`[Unreleased]`** section at the top.
- Add bullets under `Added / Changed / Fixed` as you work (or right before release).
- When releasing:
  - create a new section: `## [0.2.0] - YYYY-MM-DD`
  - move the relevant bullets from **Unreleased** into that version
  - leave `Unreleased` empty (or start new bullets for next work)

### 6.3 Choose your release method (recommended vs alternative)

You have two good options. Pick one and stay consistent.

#### Option A (recommended): use `npm version …` to create the tag

From `Portfolio/portfolio-site/`:

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

What it does:

- bumps `portfolio-site/package.json` version
- creates a commit for the bump
- creates a git tag `vX.Y.Z`

Then push:

```bash
git push
git push --tags
```

#### Option B: manual tag (if you prefer full control)

1. Edit `portfolio-site/package.json` version yourself.
2. Commit it:

```bash
git add portfolio-site/package.json
git commit -m "chore(release): v0.2.0"
```

3. Tag and push:

```bash
git tag -a v0.2.0 -m "v0.2.0"
git push
git push --tags
```

### 6.4 What happens with Vercel when you release?

Typical setup:

- Every push → Vercel preview deploy
- Every push to `main` → Vercel production deploy

So your release process already triggers deployments as long as you push your commits.

If you want a strict rule like “only deploy on tags”, that’s possible later, but not needed right now.

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

