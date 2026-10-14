# Content format

This file defines how tutorial pages are written. The site generator and the validator implement exactly this format. Writers follow it exactly.

Background: `research/00-tutorial-format.md` describes the Apple tutorial sites that this site takes its structure from. The design and all text must be original.

## Files

- `content/collection.json` — title, abstract, and the ordered list of chapters and pages.
- `content/pages/<slug>.md` — one page per file. Slugs: `welcome`, `ch01-concepts`, `ch01-build`, ... `ch13-concepts`, `ch13-build`, `wrap-up`.
- `content/images/` — `chNN-<name>.svg` diagrams and `chNN-<name>.png` screenshots.

A page that is listed in `collection.json` but has no file yet is shown as "not written yet". The build must not fail.

## Writing style (all pages)

- Plain, simple English (ASD-STE100 Simplified Technical English). Short sentences. One idea per sentence. Active voice. Simple tenses. The same word for the same thing every time.
- Address the learner as "you".
- Explain WHY, not only what. The learner wants to become a camera expert.
- Use the exact API names in code font. Link each important API or concept to its Apple documentation page the first time it appears on a page. Use only links marked as verified in `research/`.
- Do not copy Apple's documentation text. Write in your own words.

## Front matter

```
---
kind: tutorial            # or: article
chapter: 3                # 0 for welcome and wrap-up
title: Capture a photo
abstract: One sentence for the overview page and the "Next" card.
estimatedMinutes: 40
startBranch: chapter-02   # tutorial only
branch: chapter-03        # tutorial only
---
```

Only `key: value` pairs. No nested YAML.

## Article pages (`kind: article`)

Normal Markdown after the front matter:

- The paragraphs before the first `##` are the hero intro.
- `##` and `###` headings, paragraphs, lists, tables, images `![alt](../images/ch03-pipeline.svg)`.
- Fenced code blocks. Add `file=<path>` if the code is from the project (then the validator checks it against `branch` when the front matter has one).
- Asides in GitHub alert form:
  ```
  > [!NOTE]
  > Text.
  ```
  Kinds: `NOTE`, `TIP`, `IMPORTANT`, `EXPERIMENT`.
- A documentation link list (rendered as link cards):
  ````
  ```links
  AVCaptureSession | https://developer.apple.com/documentation/avfoundation/avcapturesession | The object that connects inputs to outputs.
  ```
  ````
- An article can end with a quiz (same form as in tutorials), but usually has none.

Recommended article structure for a chapter concept page:

1. Intro: what the chapter is about and why it matters.
2. `## How it works` — the concept, with one diagram.
3. `## What the camera can do` — the capability map: what the hardware and the API offer, also beyond what AVCam uses.
4. `## Why AVCam does it this way` — the design decisions and the alternatives.
5. `## Common mistakes`.
6. `## Documentation` — a `links` block.

## Tutorial pages (`kind: tutorial`)

```
Hero intro paragraphs (before the first `##`).

## Section title                      <- a section; imperative, sentence case

Section intro paragraphs. Optional one image.

### Step                              <- the literal word "Step"; numbers are generated
Instruction: the first paragraph. One action. One or two sentences.

Caption: all later paragraphs before the block. The "why". Optional.

> [!TIP]
> Optional aside inside the step.

<exactly one block: a code fence, a settings fence, or an image>

### Note                              <- an aside BETWEEN steps. Also: Tip, Important, Experiment
Text.

### Text                              <- a plain paragraph between steps
Text.

## Check your understanding           <- exact title; starts the quiz

### Question text?
Optional code fence.
- [ ] Wrong choice
  > Why it is wrong.
- [x] Correct choice
  > Why it is correct.
```

### Step blocks

**Code fence** — the code as it looks after the step, for one region of one file:

````
```swift file=AVCam/CaptureService.swift highlight=4-6,9
private func setUpSession() throws {
    ...
}
```
````

- `file=` — path from the app repository root. Required.
- `highlight=` — line numbers inside this fence (1-based) that the learner adds or changes in this step. List or ranges.
- `new` — the step creates this file. All lines are highlighted. Show the complete file.
- `transient` — this code changes again later in the same chapter. The validator skips it. Avoid it when you can.
- `copy` — boilerplate that a learner copies as it is (for example a helper file with many constants). In the "Try first" mode the code is not covered; a note says to copy it. Give the spec in the caption anyway. A fence without `highlight=` (a review step) is not covered either.
- `result="path|caption; path|caption"` — screenshots of the app after the step. The code card gets a "What you see" button that opens them in a dialog (also allowed on a settings fence). Add them only for a step with a visible change. The paths are relative to the page file, like images. Make the screenshots with `tools/capture.py` (see its header) with SimCam set to still images, so that no private video is in the pictures.
- A fence shows a region, not always the whole file. Include enough unchanged lines around the new lines (the enclosing type or method signature) that the learner knows where to type. Do not use `...` or other placeholders inside a fence: each line must be real code from the file.
- To show code that the learner must delete, put a second fence with `remove` BEFORE the main fence:
  ````
  ```swift file=AVCam/CaptureService.swift remove
  let camera = AVCaptureDevice.default(for: .video)
  ```
  ````

**Settings fence** — for steps in the Xcode UI (no code). Rendered as a card with rows:

````
```settings title="Target AVCam › Info"
Privacy - Camera Usage Description: AVCam uses the camera to take photos and record video.
```
````

Other use: a list of menu choices or template options (`Product Name: AVCam`).

**Image** — a simulator screenshot or a diagram: `![What the screen shows](../images/ch03-result.png)`.

### Validation rules (the `validate` script enforces them)

1. Each step has an instruction and exactly one block.
2. Each line of a code fence (without `transient` or `remove`) exists in the file on `branch`, in the same order (white space at line ends is ignored).
3. Coverage: each line that `git diff startBranch branch` adds to a Swift file appears as a highlighted line in at least one step for that file. The learner who follows all steps must arrive at exactly the branch code. Exceptions are listed in the front matter as `uncovered: <path>, <path>` (whole files, for example assets or the project file) and must be explained on the page.
4. Each quiz question has exactly one correct choice, and each choice has an explanation.
5. Each image file exists. Each internal link resolves.

### Content budget for a tutorial page

- 3 to 6 sections. 5 to 10 steps per section. 25 to 45 steps per page.
- Instruction: 9 to 25 words. Starts with a verb or with "In `File.swift`, ...".
- A caption on at least half of the steps: 1 to 3 sentences. This is where the reasons go.
- 1 to 8 highlighted lines per step. Split larger additions into more steps. A new helper file with boilerplate can be one larger step.
- The last step of each section is a checkpoint when possible: "Build and run", with what the learner must see.
- 3 quiz questions that test understanding, not memory.

## Swift notes (automatic)

The generator adds a "Swift" card to the step where a Swift construct (for example `#available`, `#if targetEnvironment`, `actor`, `defer`) appears for the first time in chapter order, and a short pointer to that step at later uses. The glossary is `src/lib/swift-notes.mjs`: one entry per construct with a pattern, a short text, and a link. Writers do not add these notes by hand; add an entry to the glossary instead. Constructs marked `common` get no pointer.

## Diagrams

SVG files, hand-written, simple. Use only `currentColor` and these CSS variables for colours, so that they follow the light and dark themes: `var(--accent)`, `var(--muted)`, `var(--surface)`, `var(--line)`. The site inlines SVG files. Give each SVG a `viewBox`, a `<title>`, and no fixed width or height. Use the `font-family: inherit` text default; keep text at 13 px or larger at a 720 px wide `viewBox`.

## Implementation notes

These notes say how the site generator and the validator read the rules above in the places where the rules leave a choice. They do not change the rules.

- **`collection.json`.** Each chapter has `number` (0 for the groups "Start here" and "Finish"), `title`, `abstract`, and `pages`. Each page entry has `slug`, and a placeholder `kind` and `title` that the overview shows until the page file exists. Then the front matter wins. The Xcode version (`xcode`) is in `collection.json`, not in the front matter.
- **Front matter.** The value is all text after the first colon, so a title can contain a colon. Quotes around a value are removed. A comment starts with two spaces and `#`. An unknown key gives a warning.
- **`file=` with spaces.** `file=AVCam/Preview Content/PreviewCameraModel.swift` works: the path ends at the next attribute (`highlight=`, `new`, `remove`, `transient`) or at the end of the line. `file="..."` with quotes also works.
- **Step parts.** The first paragraph is the instruction. All other content before the block (paragraphs, lists, `> [!TIP]` asides) is the caption. Content after the block is not part of the step: the site shows it as plain text between steps, and the validator gives a warning. A second block in one step is an error.
- **`remove` fences.** A step can have one or more `remove` fences before its main code fence. A `remove` fence without a main code fence is an error. The validator does not check `remove` fences against a branch.
- **Other `###` headings in a section.** Only `Step`, `Note`, `Tip`, `Important`, `Experiment`, and `Text` are valid. Any other heading is an error.
- **Line numbers.** The code panel shows the line numbers of the file at the END of the chapter (on `branch`). When a later step adds lines inside the region, the numbers of an earlier step have a gap (for example 35, 36, 45, 46). A `new` fence, a `transient` fence, and a fence that does not match the file are numbered from 1. When a fence fits in more than one place in the file, the first place is used; add more context lines to make it unique. To find the place of a fence, the validator works from the last step of the page back to the first. It knows that the highlighted lines of later steps are not in the file yet at an earlier step, so a fence that later code splits is still found in the correct place.
- **"View full file".** The dialog shows the file on `branch` (the end of the chapter), with the highlighted lines of the step marked. It can contain code from later steps.
- **Rule 2.** Leading white space must match. White space at the end of a line is ignored. Lines of the file can be between two fence lines (code that a later step adds), but the order must be the same. Empty lines in the fence must also have a partner in the file.
- **Rule 3 (coverage).** The validator runs `git diff -M --unified=0 startBranch branch -- '*.swift'`. Added lines that are empty are ignored. Each other added line must be a highlighted line (or a line of a `new` fence) in a step with the same `file=`. A highlighted line of a `transient` fence counts when the same line is in the final file. Git decides which lines are "added": sometimes a closing `}` counts as added although the learner does not type it. Then highlight that line too.
- **`uncovered:`.** The paths must be the full paths from the repository root. The validator gives a warning when the page text does not contain the file name.
- **Code in articles.** A fence with `file=` is checked like a step fence when the front matter of the article has `branch`. `highlight=` also works there.
- **Internal links.** Write `ch03-build.md`, `ch03-build.md#section-id`, or `#section-id` (also valid: without `.md`, or with `.html`). `index` is the overview. A section id is the title in lower case with hyphens (`## Create the session` gives `#create-the-session`); a step id is `#step-<section>-<step>`, for example `#step-2-5`. A link to a page that is listed but not written yet gives a warning and is shown as plain text. A link to a page that is not in `collection.json` is an error.
- **External links** open in a new tab, in `links` blocks and in normal text.
- **Images.** The path is relative to the Markdown file. The file must be inside `content/`. An image alone in a paragraph is a figure. In a section intro, the first such image goes next to the text.
- **Quiz.** A choice can have more content than one line (for example an indented code fence). The explanation is the indented `>` block of the choice. The title match for `## Check your understanding` ignores case.
- **Languages with syntax colours:** `swift`, `sh`/`bash`, `json`, `xml`/`plist`, `yaml`, `diff`, `objc`, `markdown`. Other languages show as plain text.
- **Content budget.** The budget is not a validation rule. `npm run validate -- --budget` prints notes.
