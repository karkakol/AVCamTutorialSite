# Chapter 5 build page: learner review

Date: 14 Oct 2026
Page: `content/pages/ch05-build.md` (29 steps in 4 sections), rendered as `dist/ch05-build.html` after `node src/build.mjs`.

## Method

The same two personas as in the chapter 2 and 3 reviews went through all 29 steps.

- **The copier** reads the code card and the delete boxes, pastes the highlighted lines at the place the fence shows, and builds at each checkpoint. Checked: is the place clear, is anything needed that no step says (build setting, import, Xcode action, deletion), do the delete boxes cover every line that `git diff chapter-04 chapter-05` removes or moves. This chapter moves layout code in `CameraUI.swift`, so moved lines were the focus.
- **The self-implementer** uses the "Try first" mode. This person sees the instruction, the caption, the cover (file, "Inside …", context lines, placeholder, delete box), and the Swift notes, but not the code. Checked: does the text give each new identifier with its type, access level, and position; does it name each API and SwiftUI modifier with its arguments (sizes, paddings, offsets, corner radii, materials, aspect ratios); do boilerplate steps have the `copy` mark and a spec.

The cover text of each step was extracted from the rendered HTML and compared with `git show chapter-05:<file>` and the diff. The findings were fixed on the page in the same pass (instructions, captions, and one `remove` fence; no main code fence changed). Then `npm run validate` and the replay ran.

Note on the first build: the first `node src/build.mjs` ran at the same time as `git diff` commands on the app repository, and the covers of every page lost the "Inside …" text. A second build, run alone, had all 15 "Inside …" texts on this page. See suggestion 3.

## Findings

| # | Step | Persona | Problem | Severity | Fix applied |
|---|------|---------|---------|----------|-------------|
| 1 | 3.5 | copier | The `remove` box listed only the four `VStack` lines. The highlighted lines (2 to 12) also contain the `.overlay { … }` lines and the closing `}` of `body`, because git counts them as added. A copier who deletes the box and pastes the highlighted lines gets a second `overlay` and one `}` too many; the build fails. The instruction said "keep the `overlay` modifier", which contradicts the highlighted lines. | high | The `remove` fence lists all eight old lines of `body` (the `VStack`, the `overlay`, and the closing brace). The instruction says "replace the whole content between the braces" and names the `if` on `isRegularSize`. The caption says that the `overlay` lines are among the new lines, so delete and paste in one go. |
| 2 | 3.4 | self-implementer | The panel values were not given: width 740, `.ultraThinMaterial.opacity(0.8)`, corner radius 12, bottom padding 32, and the order of the four modifiers. The caption named only `.ultraThinMaterial`. The values cannot be guessed, and the learner's layout differs from the sample. | high | Caption lists the four modifiers with their arguments, in order. |
| 3 | 2.1 | self-implementer | The names `AspectRatio`, `photoAspectRatio`, `movieAspectRatio` were not in the text; `typealias AspectRatio = CGSize` was not said. Steps 2.4 and 4.4 use these names in their solutions. | medium | Instruction names the alias and the two constants. Caption gives `CGSize`, and the two initializer calls with 3.0/4.0 and 9.0/16.0. |
| 4 | 4.1 | self-implementer | "a state property for the size of the window" did not name `windowSize`, `private`, `CGSize`, `CGSize.zero`, or the place. Steps 4.2 and 4.4 use `windowSize`. | medium | Instruction names the property, its type, access, and place; caption gives the start value. |
| 5 | 1.2 | self-implementer | The two requirements `verticalSizeClass` and `horizontalSizeClass` were not named, nor the type `UserInterfaceSizeClass?`, `{ get }`, or that the protocol refines `View`. Every later step depends on these names. | medium | Instruction names the two properties; caption gives the type, `{ get }`, `: View`, and `@MainActor`. |
| 6 | 2.2 | self-implementer | "add two lines to the documentation comment" did not give the text. The property name and its place (between the structure line and `camera`) were not said. | medium | Caption gives the two comment lines, the full property declaration, and the place. |
| 7 | 3.3 | self-implementer | "the `regularUI` property with a `ZStack`" did not say that the `ZStack` is inside a `VStack` with a `Spacer` (the caption mentioned the `Spacer` only in passing), nor `@ViewBuilder` and `some View`. | medium | Instruction gives `@ViewBuilder`, `some View`, `VStack` with `Spacer` and `ZStack`; caption says the `VStack` has no spacing argument. |
| 8 | 3.1, 4.6, 4.8 | self-implementer | The place of the two `@Environment` properties was not said. In `CameraUI` they go below `camera`; in `MainToolbar` and `CameraView` they go above it. A learner who picks one place for all three files differs from the sample in `git diff`. | low | Each instruction names the place. The caption of 3.1 gives the two declarations and says that the place differs between the files. |
| 9 | 4.2 | self-implementer | `CGSize.self`, `proxy.size`, `proxy.safeAreaInsets` with its four insets, and `windowSize = size` in the action were not named. | low | Caption names them. |
| 10 | 4.4 | self-implementer | The type `CGFloat`, `CGRect(origin: .zero, size: windowSize)`, and `rounded()` (before the division) were not said. The learner's value differs by a fraction of a point. | low | Instruction gives the type; caption gives the bounds and `rounded()`. |
| 11 | 1.3, 1.4 | self-implementer | 1.3: `Bool` and read-only were not said. 1.4: the extension type, the cases `.regular` and `.compact`, and the `&&`/`\|\|` form were not said. | low | Instructions and captions give them. |
| 12 | 2.3, 2.4 | self-implementer | 2.3: `private`, `CGFloat(-44)`. 2.4: the type `AspectRatio`, the place below `updateBlurRadius`, and the return value `photoAspectRatio`. | low | Instructions give them. |
| 13 | 3.2 | self-implementer | `some View` and `@ViewBuilder` were in the caption but not in the instruction with the property. | low | Instruction gives `@ViewBuilder` and `some View`. |
| 14 | 4.7 | self-implementer | `width` had no type (`CGFloat?`), no place (above `height`), and the modifier form `frame(width:height:)` was not named. | low | Instruction gives them. |
| 15 | 2.3, 2.5, 2.6, 2.7, 4.1, 4.2, 4.4 | self-implementer | The solutions contain the sample's comment lines (for example "// Dynamically calculate the offset for the bottom toolbar in iOS."). The text does not give them. They are harmless for the build; the learner sees them in `git diff` only. Step 4.8 says that the files must stay equal to the sample. | low | Not fixed. The doc comment of 2.2 is given (finding 6), because the instruction asks for it. The other comments are not load-bearing. |

Counts: high 2, medium 5, low 8.

### Checks that passed

- Copier: `git diff chapter-04 chapter-05` touches 5 Swift files and the project file. The project file is `uncovered:` and step 1.1 explains it with a settings card; the diff shows exactly `INFOPLIST_KEY_UISupportedInterfaceOrientations_iPhone = UIInterfaceOrientationPortrait`, as the card says.
- Copier: the delete boxes of 2.5 (`previewView`), 3.1, 4.6, 4.8 (the three `struct … : View {` lines), 4.7 (`.frame(height: height)`), and 3.5 (after finding 1) cover every line that the diff removes or moves. Step 3.2 copies the `VStack` into `compactUI` while `body` still has it; step 3.5 then removes it. No other line moves.
- Copier: every paste place is clear in all 29 steps. The `AVFoundation` import for `AVMakeRect` is step 4.3, before step 4.4 uses it. No other import, target, or Xcode action is missing.
- Copier: no step needs code from a later step. The order inside section 3 (add `compactUI` and `regularUI`, then rewrite `body`) keeps the project building at each step.
- Checkpoints 1.5, 2.8, 3.6, and 4.9 are consistent with the code at that point. The claims that the tutorial did not test rotation or the iPad layout are stated on the page.
- Covers: "Inside …" is correct on every step that has it (`protocol PlatformView: View`, `struct PreviewContainer<…>: View` with `var body`, `struct CameraUI<…>: PlatformView` with `var body`, `var regularUI`, `var compactUI`, `struct MainToolbar<…>: PlatformView › var body`). Steps whose first new line is at top level (1.2, 1.4, 2.1, 2.2, 3.1, 4.3, 4.6, 4.8) show only the file, which is correct. No step on this page creates a file, so no "create the new file" cover appears.
- Swift notes: this page has no card and no pointer. Every construct on the page (`@MainActor`, `typealias`, `@Environment`, key paths, `@State`, `@ViewBuilder`, `some View`) is a `common` entry that an earlier chapter introduced. See suggestion 1 for one construct that has no entry.
- `copy` marks: this chapter has no boilerplate file, so no step needs the mark.
- The section 2 diagram (`ch05-compact-layout.svg`) is at the right section, and its alt text matches the code (3:4 frame, 44 points up, toolbar in the bar below).

## Suggestions for the generator and the glossary

1. **Glossary: multiple trailing closures.** Step 4.2 is the first use of two trailing closures with a label: `.onGeometryChange(for: CGSize.self) { proxy in … } action: { size in … }`. A learner who knows only one trailing closure cannot write this form. Suggested entry: pattern `/\}\s+\w+:\s*\{/`, title "Multiple trailing closures", text: "A call can end with more than one closure. The first one has no label; each later one has its argument label before the brace, as in `} action: {`."
2. **Generator: delete boxes for lines that git counts as moved.** As in chapter 2, round 1, suggestion 4: when the highlighted lines of a step contain lines that already exist in the learner's file at the same place (here the `overlay` lines in 3.5), the validator cannot see it, because git counts them as replaced. A check could compare the highlighted lines with the file on `startBranch` and warn when a highlighted run repeats an existing run that no `remove` fence lists.
3. **Generator: a failed git call leaves the covers silent.** The first build of this review ran while other `git` commands used the app repository, and every cover on every page lost the "Inside …" text, with no warning. A second build alone was complete. If `repo.fileLines` or the start-branch lookup fails, the build should print a warning, so a writer does not take an incomplete page as final.
4. **Generator: two placeholders in one cover.** Steps 2.2, 3.1, 4.6, 4.8 have two highlighted runs (the structure line and the properties), so the cover has two "// your code goes here" lines, and the "Inside …" text covers only the first run. This is correct but can confuse; a short "two places" note on such covers would help.

## Validate and replay results

- `npm run validate`: 38 pages checked, `ch05-build.md` ok. 2 errors, 0 warnings, both outside this page and present before this review: `ch01-build.md` (coverage: `AVCam/CameraView.swift:23` between `start` and `chapter-01`) and `ch03-build.md` (line 1331, an image path "it only takes space." that does not exist).
- Replay (`node src/dump-steps.mjs > /tmp/steps-ch05.json && REPLAY_DIR=/tmp/replay-ch05 python3 tools/replay.py /tmp/steps-ch05.json ch05-build`): sections 1 to 4 all `claims=Y build=ok`; end state equals the branch `chapter-05`.
