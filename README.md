# AVCam tutorial site

A static web site for a tutorial that rebuilds Apple's AVCam camera sample, one chapter at a time. A small Node.js generator turns Markdown pages into plain HTML, CSS, and JavaScript. The built site needs no backend and no network.

## Install

You need Node.js 22 or later (Node.js 24 is tested) and git.

```sh
npm install
```

## Commands

| Command | What it does |
|---|---|
| `npm run build` | Builds the site into `dist/`. |
| `npm run dev` | Builds, serves `dist/` at `http://localhost:4173`, and builds again when a file in `content/` or `src/assets/` changes. The browser reloads. Use `-- --port 5000` for a different port. |
| `npm run validate` | Checks all pages against the rules in `docs/AUTHORING.md`. The exit code is 1 when there is an error. |
| `npm run validate -- ch03-build` | Checks only the named pages. |
| `npm run validate -- --budget` | Also prints notes about the content budget (step counts, instruction length). These notes are never errors. |

Add `-- --fixtures` to `build`, `dev`, or `validate` to include the test pages in `content/fixtures/`.

To look at the built site, serve `dist/` with any static file server, for example `python3 -m http.server -d dist 8000`.

## The app repository

The generator reads the tutorial app (the project that the learner builds) with `git show` and `git diff`. It never writes to it.

- The path comes from the environment variable `APP_REPO`. The default is `../AVCamTutorialApp`.
- With the repository, the build shows real line numbers in the code panel and adds the "View full file" control. The validator checks each code fence against the branch (rule 2) and checks the coverage of added lines (rule 3).
- Without the repository, or without the branch of a page, the build still works. Line numbers start at 1. The validator prints a warning and skips these checks.

```sh
APP_REPO=/path/to/AVCamTutorialApp npm run validate
```

## Folders

```
content/
  collection.json      title, abstract, Xcode version, chapters, and the page list
  pages/<slug>.md      one page per file (format: docs/AUTHORING.md)
  images/              chNN-<name>.svg diagrams and chNN-<name>.png screenshots
  fixtures/            test pages for the generator (built only with --fixtures)
docs/                  AUTHORING.md (the content format) and PLAN.md
src/
  build.mjs            the build command
  dev.mjs              the development server
  validate.mjs         the validator
  lib/                 parser, analysis, highlighter, HTML templates
  assets/              site.css, site.js, fonts
dist/                  the built site (not in git)
```

How the content folders work:

- `content/collection.json` gives the order of the chapters and pages. A page in the list without a Markdown file shows as "Not written yet" on the overview. The "Next" card skips it. The `title` and `kind` in the list are placeholders; the front matter of the page replaces them.
- A Markdown file in `content/pages/` that is not in the list is not built. The build prints a warning.
- Image paths are relative to the Markdown file (`../images/ch03-pipeline.svg`). SVG files are put into the page, so they can use the CSS variables of the site. Other images are copied to `dist/media/`.

## Fixtures

`content/fixtures/` has one tutorial page and one article page that use each feature of the format. They need a small test repository:

```sh
sh content/fixtures/make-app-repo.sh /tmp/fixture-app
APP_REPO=/tmp/fixture-app npm run validate -- --fixtures
APP_REPO=/tmp/fixture-app npm run dev -- --fixtures
```

## How the site works

- Each page is one HTML file in `dist/` (`index.html`, `<slug>.html`). All links are relative, so the site works in any folder of a server.
- Code is highlighted at build time (Shiki). The colours are in `src/assets/site.css`.
- Progress (done steps, complete pages, quiz answers, the place where the learner stopped) and the theme are in `localStorage` of the browser. The site also works when storage is not available.
- Fonts are in `src/assets/fonts/` (Source Sans 3 and JetBrains Mono, SIL Open Font License; the licence files are next to them).

## Dependencies

- `markdown-it`: the Markdown parser.
- `shiki`: the syntax highlighter (build time only).
