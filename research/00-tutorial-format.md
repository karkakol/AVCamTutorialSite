# Tutorial format spec: Apple "Develop in Swift" and "App Dev Training"

Purpose: describe the structure, page anatomy, and teaching patterns of two Apple tutorial sites, so we can build a similar self-hosted site for AVCam. This is a description of patterns. Do not copy Apple's text, images, icons, or CSS.

Sources studied (1 Oct 2026):

- `https://developer.apple.com/tutorials/develop-in-swift/` (short name below: **DIS**)
- `https://developer.apple.com/tutorials/app-dev-training/` (short name below: **ADT**)

Method:

- Downloaded both collection JSON files and all 137 page JSON files (64 hands-on tutorials, 73 articles) from `/tutorials/data/tutorials/<collection>/<slug>.json`. All numbers in this spec come from scripts run over those files.
- Loaded pages in a browser and took screenshots at about 1280 px, 1440 px, 768 px, and 375 px width (dark colour scheme only).
- Pages inspected visually: ADT overview, DIS overview (mobile), ADT "Creating a card view" (tutorial), DIS "Hello, SwiftUI" (tutorial), ADT "Supporting multiple windows" (article).

Both sites use the same renderer (DocC / swift-docc-render) and the same JSON schema. They differ in content choices, not in page mechanics.

---

## 1. Information hierarchy

```
Collection (overview page)
└── Volume            (a big theme; has name, short text, image)
    └── Chapter       (numbered inside its volume; has name, short text, image)
        └── Page      (one of two kinds)
            ├── Article   -> hero + prose body (+ optional quiz) + next call to action
            └── Tutorial  -> hero + Sections + quiz + next call to action
                └── Section   (numbered "Section 1..N"; title, intro text, intro image)
                    └── Step  (numbered "Step 1..N" inside its section)
```

In the JSON, a hands-on tutorial has `kind: "project"` and an article has `kind: "article"`. Sections are called `tasks`. The quiz is `assessments`. The next link is `callToAction`.

### Size of each collection

| | DIS | ADT |
|---|---|---|
| Volumes | 8 | 4 |
| Chapters | 29 | 22 |
| Hands-on tutorials | 34 | 30 |
| Articles | 43 | 30 |
| Pages per chapter | 1 to 6, usually 2 or 3 | 1 to 6, usually 2 to 4 |

### Metadata at each level

| Level | Fields | Notes |
|---|---|---|
| Collection | title, one-sentence abstract, hero image, primary button ("Get started" linking to the first page), total estimated time | Total time only in ADT (shown as hours and minutes). DIS has no time. |
| Volume | name, 1 sentence of text, image | First DIS volume has no image. |
| Chapter | name, 1 or 2 sentences of text (20 to 60 words), image, ordered list of pages | Chapter number restarts at 1 in each volume. |
| Page reference (as listed on the overview) | title, kind (article or tutorial), URL, estimated time | Time only in ADT. |
| Tutorial hero | chapter name (eyebrow), title, 1 to 4 intro paragraphs, background image, estimated time in minutes, project files download (one zip), Xcode version requirement | ADT: all 30 have time and Xcode version, 29 have project files. DIS: no time, no Xcode version, only 13 of 34 have project files. |
| Article hero | title, 1 or 2 intro paragraphs, background image, estimated time | Time only in ADT. No chapter eyebrow in the JSON for articles. |
| Section | title, anchor (URL slug), intro text, intro media (image, rarely video), media position (trailing or leading) | Section number is generated, not stored. |
| Step | instruction text, optional caption (the "why" text), then exactly one of: code file state, or media (image or video). A code step can also have a runtime preview (image or video). | Step number is generated, not stored. |
| Code file state (one per code step) | file name, syntax, full content as an array of lines, list of highlighted line numbers | Stored once per step. It is the whole file after the step, not a diff. |
| Quiz question | question text, optional extra content, 2 to 4 choices; each choice has content (text or code block), `isCorrect`, and a justification text | |
| Call to action | eyebrow ("Tutorial" or "Article"), title of the next page, abstract of the next page, image, button label | |

Each page JSON also carries the full collection hierarchy (all chapters, all pages, all section anchors). The navigation bar builds its two dropdowns from that.

---

## 2. Overview page anatomy

Order from top to bottom:

1. **Sticky navigation bar.** Collection name plus the word "Tutorials" in an accent colour. On the overview it has no dropdowns.
2. **Hero.** Centred. Large title, one-sentence abstract, (ADT only) clock icon with total time and the label "Estimated Time", one primary pill button ("Get started") that opens the first page. A large illustration sits below or behind the text.
3. **Body with two columns (desktop).**
   - **Left: sticky sidebar.** A list of volume names. One volume is expanded at a time and shows its chapter names. The chapter currently in view is highlighted (scroll spy). Clicking a chapter scrolls to it. The last entry is "Resources".
   - **Right: content column.** A stack of cards on a slightly lighter background:
     - **Volume card:** centred illustration, volume name, one sentence.
     - **Chapter card (one per chapter):** illustration on the left; on the right an eyebrow "Chapter N", the chapter name, and the short description. Below that, the page list.
     - **Page list:** one row per page. Each row has a small round icon (document icon for an article, list icon for a tutorial), the page title as a link, and (ADT only) a clock icon with the time at the right edge. On DIS the icons are joined by a thin vertical line, like a timeline.
4. **Resources section.** A short sentence and 3 to 5 tiles (documentation, videos, forums, sample code, downloads). Each tile has a title, a short text or link list, and a link.
5. **Footer.** Includes a light / dark / auto colour scheme switch.

### Progress indicators

There is **no saved progress**. The site stores nothing in `localStorage` (checked). There are no checkmarks or "completed" states on the overview. The only position indicators are:

- the scroll-spy highlight in the overview sidebar,
- "N of M" next to the section name in the tutorial navigation bar,
- "Question N of M" in the quiz,
- the active-step highlight in a tutorial.

A few DIS titles carry a text prefix "New:" to mark recent pages. It is part of the title text, not a badge.

---

## 3. Tutorial page anatomy

Order from top to bottom:

### 3.1 Navigation bar (sticky)

- Left: collection name, links back to the overview.
- **Dropdown 1: page picker.** Shows the current page title. Opens a scrolling list of all pages, grouped under chapter names. The current page is bold.
- **Dropdown 2: section picker.** Shows the current section name and "N of M". Lists "Introduction", every section title, and "Check Your Understanding". It updates as the reader scrolls. Choosing an entry scrolls to that anchor. Each section has a URL hash (for example `#Stylize-the-card`), so deep links work.
- Articles get the same bar. Their second dropdown lists the article's headings.

### 3.2 Hero (dark, full width)

- Eyebrow: chapter name.
- Title (very large).
- 1 to 4 intro paragraphs. Typical content: what the app or feature is, what "you'll build" in this tutorial, and (ADT) one sentence that says to download the starter project or open the finished one. Median length: 46 words (DIS), 76 words (ADT).
- Metadata row (ADT), three cells split by thin vertical rules: big number with "mins" and label "Estimated Time"; download icon with "Project files" link; Xcode icon with "Xcode 16" link.
- Background illustration on the right, partly dimmed.

### 3.3 Section header (repeats per section)

- Left: eyebrow "Section N", section title, 1 to 3 intro paragraphs. The intro explains the concept and the goal before any step. Median 24 words (DIS), 45 words (ADT). A few ADT sections have long intros (up to about 290 words) with several text-and-image rows.
- Right: an illustration or diagram (almost always "trailing"; ADT sometimes puts it on the left).
- A thin rule or spacing, then the steps.

### 3.4 Steps area (the core pattern)

Desktop layout is two columns:

- **Left column (about 35 to 40 % of the width): step cards.** They scroll normally. There is a lot of vertical space between cards (about half a screen), so only one or two cards are in view at a time.
- **Right column (rest of the width): one sticky panel.** It stays fixed for the whole section and fills the viewport height. Its content changes to match the step that is nearest the middle of the viewport. There is no click needed; scrolling drives it.

**Step card:**

- Rounded dark card. Small bold label "Step N". Instruction text below it.
- If the step has a caption, a thin horizontal rule follows, then the caption in the same card.
- An aside (Note, Tip, Experiment) can sit inside the caption. It has a small coloured label and no box of its own.
- The active card has a thick accent-colour bar on its left edge. Other cards have no bar.

**Right panel for a code step:**

- Header: language icon plus the file name (for example `CardView.swift`). It works like a single file tab. Only one file shows at a time.
- The **whole file** as it is after this step, with line numbers and syntax colours.
- **Changed or added lines are highlighted:** a lighter background band across the full width, plus a narrow accent bar at the left edge of each highlighted line. Deleted lines are not shown at all.
- The panel scrolls so the highlighted lines are in view. Long lines scroll sideways.
- When the file is new, every line is highlighted. Some steps highlight nothing (for example "review this file").
- **Runtime preview:** a floating card in the top-right corner of the code panel, titled "Preview", with a small collapse button. It shows a screenshot (or short video) of the app after the step. When a step has no preview, the card collapses to a small disabled "No Preview" pill.

**Right panel for a media step:**

- One image or one short video, centred. Videos show a "Play" control and do not need sound.
- Screenshots of Xcode are often dimmed with one region left bright, to point at the control in question. That effect is baked into the image.

**Text between cards (ADT style):**

- A plain paragraph or an aside can sit between two step cards, outside any card. It has no card background. ADT uses this a lot: 262 paragraphs and 168 asides between steps. Common uses: a "the compiler shows an error now, you fix it in the next step" note, and a closing paragraph after the last step that says what comes next.
- DIS never does this. DIS puts every aside inside a step caption.

**Aside kinds seen:** Note (most common), Tip, Experiment (asks the reader to try a variation), Important (rare). In articles an aside is a bordered rounded box with a bold label. In step cards it is a label plus text.

**Mix of step kinds:**

| Step kind | DIS (1402 steps) | ADT (1041 steps) |
|---|---|---|
| Code only | 24 % | 75 % |
| Code + preview | 55 % | 12 % |
| Image | 18 % | 5 % |
| Video | 2 % | 8 % |

Every step has either code or media. There are no text-only steps.

**Code facts:**

- Median file length shown: 29 lines (DIS), 34 lines (ADT). Maximum: 108 (DIS), 180 (ADT). Files are kept short on purpose.
- Highlighted lines per code step: median 3 (DIS), 2 (ADT); 75 % of steps highlight 5 lines or fewer.
- A tutorial touches a median of 4 or 5 different files. About 80 to 85 % of consecutive code steps stay in the same file.
- DIS files include the standard Xcode header comment. ADT files do not.

### 3.5 Quiz: "Check Your Understanding"

- A separate full-width block after the last section. It is also the last entry in the section dropdown.
- Shows one question at a time with "Question N of M".
- Question text, sometimes followed by a code block.
- Choices are large selectable cards (radio behaviour). A choice is a line of text or a code block.
- Two buttons below: "Submit" and "Next question". Both start disabled.
- Almost always 3 questions per tutorial (range 1 to 5). 2 to 4 choices per question, usually 3.
- Every choice, right or wrong, has its own short explanation (1 or 2 sentences).
- In ADT 40 % of choices are code blocks. In DIS 9 %.
- Question types seen: "which code does X", "what does this code do", true or false, "which statement is correct".
- 29 of 34 DIS tutorials and 29 of 30 ADT tutorials have a quiz. Tutorials about tools or process may skip it. Articles almost never have one (1 of 73).

### 3.6 Next call to action

- Full-width block at the end. Eyebrow "Next", the next page title, its abstract (1 to 3 sentences), one pill button, and an image on the right.
- Button label depends on the next page kind: "Get started" for a tutorial, "Read article" for an article.
- Every page has one, except the last page of a track.

### 3.7 Article page anatomy

- Same navigation bar and the same hero style (title, intro, time in ADT).
- Body is a single centred column on a card background, max width about 800 px.
- Blocks used: H2 and H3 headings, paragraphs, bullet and numbered lists, inline images, code listings with line numbers (no highlights, no file name), asides in bordered boxes, text-plus-image rows, 2 or 3 column rows, rarely a table.
- Ends with the same "Next" call to action.

---

## 4. Step writing style

### Numbers

| | DIS | ADT |
|---|---|---|
| Sections per tutorial | median 6 (1 to 10) | median 4 (1 to 8) |
| Steps per section | median 7 (middle half 4 to 9, max 16) | median 8 (middle half 5 to 10, max 14) |
| Steps per tutorial | median 40 (8 to 85) | median 32 (9 to 63) |
| Words in a step instruction | median 18 (middle half 12 to 25) | median 12 (middle half 9 to 17) |
| Sentences in a step instruction | 1 in 55 %, 2 in 34 % | 1 in 85 %, 2 in 13 % |
| Steps that have a caption | 54 % | 48 % |
| Words in a caption | median 21 | median 19 |
| Steps with inline code names | 52 % | 74 % |
| Minutes per tutorial | not given | median 25 (10 to 40) |

So ADT moves at roughly 45 seconds per step.

### The instruction (first paragraph of a step)

- One action per step. One small, visible change.
- Imperative voice, addressed to "you". It starts with a verb or with a location phrase.
- Most common first words: "Add", "In" (as in "In `X.swift`, ..."), "Create", "Use", "Open", "Build", "Assign", "Call", "Update", "Replace", "Wrap", "Set", "Import".
- It names the exact symbol, file, or menu item in code font. It often says where: which file, which type, above or below which line.
- It does not explain why. It can be as short as two words.
- DIS (beginner audience) writes longer instructions and sometimes uses a step to explain a concept with no action ("The X modifier does Y").

### The caption (the "why" paragraph under the rule)

- Present in about half of the steps. One to two sentences, about 20 words.
- It gives one of these:
  - the reason for the change ("Because ...", "You import X so that ..."),
  - what the API does ("The system calls this method when ..."),
  - what the reader should now observe ("Notice ...", "The preview now shows ..."),
  - a link back to earlier material ("Recall that ..."),
  - a look ahead ("You'll fix this in the next step").
- Most common first words: "The", "You", "This", "You'll", "Recall", "Because", "If", "When", "Notice".
- Trivial steps (rename, import, add an empty line) have no caption.

### Section and page titles

- Section titles are short imperatives: "Create ...", "Add ...", "Display ...", "Use ...", "Make ...".
- Tutorial titles: DIS uses imperatives ("Save data"). ADT uses gerunds ("Persisting data").
- Sentence case everywhere.

### Other teaching patterns

- **Deliberate errors.** A step may leave the project in a state that does not compile. A note says so and promises the fix in the next step.
- **Experiments.** An "Experiment" aside asks the reader to change a value and watch the result. DIS has 105 of these.
- **Build and run checkpoints.** Sections often end with a "build and run" step that has a screenshot or video of the result.
- **Bridges.** The last text in a section or tutorial says what the next one does.
- **Small diffs.** Typically 1 to 5 new lines per step. Large pasted blocks are rare and are reserved for sample data or boilerplate.
- **Review steps.** "Open X and review the code" steps show a file with no highlight and explain it in the caption.

---

## 5. ADT specifics: articles mixed with tutorials, start and complete projects

### Mix of articles and tutorials

- The page list of a chapter mixes both kinds freely. The row icon and the call-to-action label ("Read article" or "Get started") tell them apart. Both kinds share the navigation dropdown and the "Next" chain, so the reader follows one linear path.
- Each volume builds **one sample app** from start to finish (SwiftUI volume: a meeting timer app; UIKit volume: a reminders app; "Next steps": an earthquake data app).
- Article roles:
  - **Opening article** of a volume ("Getting started with ..."): who it is for, what you need, a tour of the finished app with screenshots, tips for success. 5 minutes.
  - **Concept article** placed right before the tutorial that needs it (for example data flow before the editing tutorial). 5 to 15 minutes. Diagrams, short code listings. Reads like a short lecture.
  - **Closing article** of a volume: recap and links to more material.
- Typical rhythm in a chapter: concept article, then one or two hands-on tutorials that apply it.
- The macOS volume is different. It is almost all articles (15 articles, 1 tutorial). Each article walks through one finished sample app and shows code listings from it. A "Project Files" note at the top of each article links to the one sample zip.
- ADT articles are longer than DIS articles: median 554 words and 2 to 8 code listings, against 178 words and usually no code in DIS.
- DIS uses articles differently: a "Welcome to ..." article opens each volume, and a "Wrap-up: ..." article follows almost every tutorial. A wrap-up has fixed headings: reflect on the concepts, list of topics covered, continue practising (extend your app, challenge yourself), learn more, what's next.

### Start and complete projects

- 29 of 30 ADT tutorials have their own zip, named after the tutorial (for example `CreatingACardView.zip`). The hero links to it as "Project files".
- The hero text tells the reader to download the starter project and follow along, or to open the finished project and explore.
- The starter project of tutorial N is the finished state of tutorial N-1. A reader can start at any tutorial.
- Steps can refer to resource folders inside the starter project. A note at the first such step reminds the reader to use the starter project.
- Each code step also stores the full file state, so a stuck reader can compare with the page.
- Not verified: the folder names inside the zip. I did not download any zip. From memory they are a "StartingProject" folder and a "Complete" folder; treat that as unconfirmed.
- DIS mostly starts from an empty Xcode template. Only 13 of 34 DIS tutorials have a zip, used when the tutorial needs assets or a prepared starting point.

---

## 6. Responsive behaviour

Observed at 375 px, 768 px, 1280 px, and 1440 px.

### Desktop and tablet (768 px and wider)

- Two-column step layout stays down to 768 px. The step column gets narrow; the code panel keeps most of the width. Code lines scroll sideways inside the panel.
- Navigation bar keeps both dropdowns.
- Overview keeps the sidebar at 1280 px. Not checked at 768 px.

### Phone (375 px)

- **Navigation bar:** collapses to the collection name and one chevron. The chevron opens one menu with chapters, their pages, and the current page's sections.
- **Hero:** single column. Metadata row (time, project files, Xcode) stays on one line. Background image stays behind the text, dimmed.
- **Section header:** text first, illustration below it, full width.
- **Steps:** the sticky panel is gone. The page is one column. After each step card comes its own asset:
  - **Code step:** a compact code box. Header with file name as a link. Only the highlighted lines plus about 2 lines of context above and below. Real line numbers are kept (for example 12 to 16). Sideways scroll for long lines. The file name opens the full file in a modal. If the step has a preview, a "Preview +" link under the code opens it in a modal.
  - **Media step:** the image or video inline, full width.
- **Asides and paragraphs between steps:** plain text, full width.
- **Overview:** no sidebar. Volume card, then chapter cards stacked: image on top, "Chapter N", name, description, page list.
- **Quiz and call to action:** single column; the image moves under the text.

Not measured: the exact pixel width where the layout switches from two columns to one. It is between 375 and 768 px. The open-source renderer uses about 735 px for its "small" breakpoint, which matches.

Not seen: light colour scheme (the browser was in dark mode), and the result state of the quiz after "Submit" (I did not click it).

---

## 7. Recommendations for the AVCam site

### 7.1 Keep these patterns

1. One overview page: hero, chapter cards, page rows with kind icon and time.
2. Two page kinds: **article** (prose) and **tutorial** (sections and steps).
3. Tutorial page: hero with time, project files, and Xcode version; numbered sections with intro and image; step cards on the left; sticky code panel on the right, driven by scroll.
4. Whole-file code state per step with highlighted changed lines and a file name header.
5. Caption under a rule for the "why". Keep it optional and short.
6. Asides: Note, Tip, Experiment, Important.
7. Quiz of 3 questions with an explanation for every choice.
8. "Next" call to action on every page.
9. Top bar with a page picker and a section picker with "N of M".
10. Phone layout: inline code excerpt per step with a link to the full file.

### 7.2 Change these for AVCam

- **Volumes are not needed.** Use collection -> chapters -> pages. One app, one track.
- **Long files.** AVCam source files are much longer than Apple's tutorial files (median about 30 lines there). Showing a whole 400-line file per step works poorly. Options: (a) show the whole file but auto-scroll to the highlight and collapse far-away regions behind a "show N lines" control; (b) let a step declare a line window to show. Keep real line numbers either way.
- **No SwiftUI preview for a camera.** Use the preview slot for a device screenshot or short video only at checkpoints. Expect a mix like ADT: about 75 % code-only steps.
- **Diagrams.** Use the section intro image slot for capture pipeline diagrams (session, inputs, outputs, actors).
- **Saved progress (optional improvement).** Apple has none. We can store completed steps or pages in `localStorage` and show a check mark on the overview rows. This is cheap and useful for a self-paced site.
- **Concept articles before hard chapters.** Follow the ADT rhythm: a short article on a concept (for example capture session configuration, actor isolation, device rotation), then the tutorial that applies it.
- **Start and complete states.** Give each chapter a start and a complete project, where the start equals the previous chapter's complete state. Git tags or branches per chapter can replace zips; still offer a zip link in the hero.

### 7.3 Content budget per tutorial (targets from the data)

- 3 to 6 sections.
- 5 to 10 steps per section. 25 to 45 steps per tutorial.
- Instruction: 1 sentence, 9 to 20 words, starts with a verb or "In `File.swift`, ...".
- Caption on about half of the steps, 1 or 2 sentences, about 20 words.
- 1 to 5 highlighted lines per step.
- Section intro: 25 to 60 words plus one image.
- Hero intro: 2 or 3 short paragraphs, 50 to 80 words.
- 20 to 40 minutes per tutorial. Estimate about 45 seconds per step.
- 3 quiz questions.

### 7.4 Data model

One file per page. Markdown with front matter is easiest to write by hand; the build step turns it into the JSON below. The JSON mirrors the DocC shape, simplified.

**Collection (`collection.json`)**

```json
{
  "title": "Build a camera app",
  "abstract": "One sentence.",
  "heroImage": "images/hero.png",
  "estimatedMinutes": 240,
  "chapters": [
    {
      "id": "capture-basics",
      "title": "Capture basics",
      "abstract": "One or two sentences.",
      "image": "images/ch1.png",
      "pages": ["getting-started", "setting-up-the-session"]
    }
  ],
  "resources": [
    { "title": "Documentation", "text": "...", "links": [{ "label": "...", "url": "..." }] }
  ]
}
```

**Tutorial page (`setting-up-the-session.json`)**

```json
{
  "kind": "tutorial",
  "slug": "setting-up-the-session",
  "chapter": "capture-basics",
  "title": "Setting up the capture session",
  "intro": ["Paragraph 1 (Markdown).", "Paragraph 2."],
  "heroImage": "images/t2-hero.png",
  "estimatedMinutes": 25,
  "xcode": "Xcode 26",
  "projectFiles": { "label": "Project files", "url": "downloads/SettingUpTheSession.zip" },
  "sections": [
    {
      "anchor": "create-the-session",
      "title": "Create the session",
      "intro": ["Markdown paragraph."],
      "media": { "type": "image", "src": "images/t2-s1.png", "alt": "...", "position": "trailing" },
      "items": [
        { "type": "aside", "style": "note", "content": "Markdown." },
        {
          "type": "step",
          "instruction": "Markdown, one sentence.",
          "caption": "Markdown, optional.",
          "asides": [{ "style": "tip", "content": "Markdown." }],
          "code": {
            "file": "CaptureService.swift",
            "language": "swift",
            "source": "code/t2/s1-03-CaptureService.swift",
            "highlights": [14, 15, 16],
            "window": [1, 40]
          },
          "preview": { "type": "image", "src": "images/t2-s1-03.png", "alt": "..." }
        },
        {
          "type": "step",
          "instruction": "Markdown.",
          "media": { "type": "video", "src": "videos/t2-s1-04.mp4", "poster": "images/t2-s1-04.png", "alt": "..." }
        },
        { "type": "paragraph", "content": "Bridge text after the last step." }
      ]
    }
  ],
  "quiz": [
    {
      "question": "Markdown.",
      "content": "Optional Markdown or code block.",
      "choices": [
        { "content": "Markdown or code.", "correct": false, "justification": "Why it is wrong." },
        { "content": "Markdown or code.", "correct": true, "justification": "Why it is right." }
      ]
    }
  ],
  "next": { "slug": "showing-the-preview" }
}
```

Rules:

- A step has `code` or `media`, never both. `preview` is allowed only with `code`.
- `items` is an ordered list so that paragraphs and asides can sit between steps.
- `code.source` points to a full file snapshot for that step. Generate `highlights` in the build by diffing against the previous snapshot of the same file; allow a manual override.
- `window` is our addition for long files. Omit it to show the whole file.
- `next` needs only the slug. The build fills title, abstract, kind, and image from the target page.
- Step and section numbers are computed, never stored.

**Article page**

```json
{
  "kind": "article",
  "slug": "getting-started",
  "title": "Getting started with AVCam",
  "intro": ["..."],
  "heroImage": "images/a1-hero.png",
  "estimatedMinutes": 5,
  "body": "Markdown with H2/H3, lists, images, fenced code, and asides (> [!NOTE] ...)",
  "quiz": [],
  "next": { "slug": "setting-up-the-session" }
}
```

**Markdown authoring form for a tutorial (suggestion)**

```markdown
---
kind: tutorial
title: Setting up the capture session
chapter: capture-basics
estimatedMinutes: 25
xcode: Xcode 26
projectFiles: downloads/SettingUpTheSession.zip
heroImage: images/t2-hero.png
---
Intro paragraph.

## Create the session
![alt](images/t2-s1.png)
Section intro paragraph.

### Step
Instruction sentence.
---
Caption sentence.
> [!TIP] Optional aside.
@code(CaptureService.swift, code/t2/s1-03-CaptureService.swift)
@preview(images/t2-s1-03.png)

### Step
Instruction sentence.
@image(images/t2-s1-04.png)

## Quiz
### Question text
- [ ] Wrong choice :: Why it is wrong.
- [x] Right choice :: Why it is right.
```

### 7.5 Components needed

Overview page:

- `TopNav` (collection title; on content pages: page picker, section picker with "N of M"; collapses to one menu on phones)
- `OverviewHero` (title, abstract, total time, start button, image)
- `ChapterSidebar` (sticky, scroll spy)
- `ChapterCard` (image, "Chapter N", title, abstract)
- `PageRow` (kind icon, title link, time, optional done mark)
- `ResourceTiles`
- `Footer` with `ThemeToggle` (light, dark, auto)

Tutorial page:

- `TutorialHero` (chapter eyebrow, title, intro, background image)
- `MetaRow` (time, project files, Xcode version)
- `SectionHeader` (eyebrow "Section N", title, intro, media, anchor)
- `StepsLayout` (two columns; left scrolls, right sticky; uses IntersectionObserver to pick the active step)
- `StepCard` (label, instruction, rule, caption, inline asides, active state)
- `InterStepText` (paragraph or aside between cards)
- `CodePanel` (file header, line numbers, syntax colours, highlighted lines, auto-scroll to highlight, sideways scroll, optional collapsed regions)
- `PreviewCard` (floating, collapsible, "no preview" state)
- `MediaPanel` (image or video with play control and poster)
- `MobileStepAsset` (inline code excerpt with context lines; `FullCodeModal`; `PreviewModal`)
- `Aside` (note, tip, experiment, important; card style for articles, label style for steps)
- `Quiz` (question counter, choice cards with text or code, submit, per-choice explanation, next question, final state)
- `NextCallToAction` (eyebrow, title, abstract, button label by kind, image)

Article page:

- `ArticleHero`, `ArticleBody` (Markdown renderer with headings, lists, images, code listings with line numbers, asides, text-plus-image rows, columns, tables), `NextCallToAction`

Shared:

- Syntax highlighter for Swift (build-time highlighting keeps the page light)
- Build step: Markdown to JSON, snapshot diff to highlights, heading anchors, next and previous links, hierarchy for the dropdowns
- Optional `ProgressStore` (`localStorage`) for completed pages

### 7.6 Design direction (original, not a copy)

- Keep the layout ideas: dark hero, card-based steps, sticky code panel, generous vertical spacing, one accent colour for active states.
- Choose our own typeface, colours, icons, and illustrations.
- Support light and dark colour schemes.
- Keep the body column for articles near 700 to 800 px wide.

---

## 8. What I could not verify

- Quiz behaviour after "Submit" (feedback styling, final "all done" state). I saw the idle state only. The JSON confirms a justification per choice.
- The folder layout inside the project zips (start and complete folders). No zip was downloaded.
- The exact breakpoint between the two-column and one-column step layouts (between 375 and 768 px).
- Light colour scheme appearance.
- Overview sidebar behaviour at tablet width.
- Whether the code panel animates between steps (screenshots are static).
- Video autoplay and loop behaviour. Videos showed a "Play" control when paused.
