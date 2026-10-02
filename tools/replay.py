#!/usr/bin/env python3
"""Replays each tutorial page step by step and builds the app at the end of each section.

For each tutorial page it starts from `startBranch`, applies the steps in order
(the highlighted lines of each step are added, the lines of `remove` fences are
deleted), and runs `xcodebuild` at the end of each section. It also checks that
the state after the last step is equal to `branch`.

Usage:  node src/dump-steps.mjs > /tmp/steps.json
        python3 tools/replay.py /tmp/steps.json [slug ...] [--no-build]
Result: a table on standard output, and docs/review/replay.md.
"""
import difflib, json, os, re, shutil, subprocess, sys, tempfile

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP = os.environ.get("APP_REPO", os.path.join(os.path.dirname(SITE), "AVCamTutorialApp"))
WORK = os.environ.get("REPLAY_DIR", os.path.join(tempfile.gettempdir(), "avcam-replay"))
CLAIM = re.compile(r"Command-B|[Bb]uild and run|project builds|[Bb]uild the (app|project)")


def git(*args):
    return subprocess.run(["git", "-C", APP, *args], capture_output=True, text=True)


def show(branch, path):
    r = git("show", f"{branch}:{path}")
    return r.stdout.split("\n") if r.returncode == 0 else None


def swift_files(branch):
    out = git("ls-tree", "-r", "--name-only", branch).stdout.split("\n")
    return [p for p in out if p.endswith(".swift")]


START = BRANCH = None


def git_opcodes(path, n_old, n_new):
    """The same alignment that `git diff` (and so the validator) uses."""
    out = git("diff", "--no-color", "--no-ext-diff", "--unified=0", START, BRANCH, "--", path).stdout
    ops, i, j = [], 0, 0
    for m in re.finditer(r"^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@", out, re.M):
        a, al = int(m.group(1)), int(m.group(2) or 1)
        b, bl = int(m.group(3)), int(m.group(4) or 1)
        a0 = a - 1 if al else a          # with a length of 0, git gives the line BEFORE the change
        b0 = b - 1 if bl else b
        if a0 > i:
            ops.append(("equal", i, a0, j, j + (a0 - i)))
        ops.append(("replace", a0, a0 + al, b0, b0 + bl))
        i, j = a0 + al, b0 + bl
    if i < n_old:
        ops.append(("equal", i, n_old, j, j + (n_old - i)))
    return ops


class FileState:
    """One Swift file: which final lines and which start lines are present now."""

    def __init__(self, path, start, final):
        self.path, self.start, self.final = path, start, final
        s, f = start or [], final or []
        self.ops = git_opcodes(path, len(s), len(f)) if (start is not None and final is not None) else \
            difflib.SequenceMatcher(None, s, f, autojunk=False).get_opcodes()
        self.added = set()      # final line numbers (1-based) added by steps
        self.removed = set()    # trimmed text of start lines removed by steps
        self.exists = start is not None
        self.moved_to = {}
        for tag, i1, i2, j1, j2 in self.ops:
            if tag != "equal":
                for j in range(j1, j2):
                    self.moved_to.setdefault(f[j].strip(), []).append(j)
        self.touched = False

    def apply(self, step):
        if step.get("file") == self.path:
            self.touched = True
            self.exists = True
            self.added.update(step.get("highlightFileLines", []))
        for r in step.get("removes", []):
            if r["file"] == self.path:
                self.removed.update(l.strip() for l in r["lines"])

    def lines(self):
        s, f = self.start or [], self.final or []
        out = []
        for tag, i1, i2, j1, j2 in self.ops:
            if tag == "equal":
                out.extend(f[j1:j2])
                continue
            for i in range(i1, i2):          # old lines that the chapter removes
                t = s[i].strip()
                if not t or t in self.removed:
                    continue
                # A moved line (for example with a new indent) goes away when its new form is added.
                moved = [j for j in self.moved_to.get(t, [])]
                if moved and any((j + 1) in self.added for j in moved):
                    continue
                out.append(s[i])
            for j in range(j1, j2):          # new lines that the chapter adds
                if (j + 1) in self.added or (f[j].strip() == "" and self.touched):
                    out.append(f[j])
        return out


def normal(lines):
    return [l.rstrip() for l in lines if l.strip()]


def replay(page, build=True):
    start, branch, slug = page["startBranch"], page["branch"], page["slug"]
    paths = sorted(set(swift_files(start)) | set(swift_files(branch)))
    global START, BRANCH
    START, BRANCH = start, branch
    states = {p: FileState(p, show(start, p), show(branch, p)) for p in paths}
    work = os.path.join(WORK, slug)
    shutil.rmtree(os.path.join(work, "src"), ignore_errors=True)
    os.makedirs(os.path.join(work, "src"), exist_ok=True)
    # Project file, assets, and other files that are not Swift: the state of the finished chapter.
    tar = subprocess.Popen(["git", "-C", APP, "archive", branch], stdout=subprocess.PIPE)
    subprocess.run(["tar", "-x", "-C", os.path.join(work, "src")], stdin=tar.stdout, check=True)
    deleted = [p for p in paths if states[p].final is None]
    results = []
    # The project file: the learner changes it in the Xcode steps (`settings` blocks). Use the
    # start version until the first step of that kind, then the version of the finished chapter.
    project = "AVCam.xcodeproj/project.pbxproj"
    start_project = git("show", f"{start}:{project}").stdout
    final_project = git("show", f"{branch}:{project}").stdout
    # If no step of the page changes a target in Xcode, use the final project file at once.
    has_target_step = any(i["type"] == "step" and i.get("block") == "settings" and re.search(r"[Tt]arget", i["instruction"])
                          for sec in page["sections"] for i in sec["items"])
    seen_settings = [not has_target_step]

    def write_project():
        with open(os.path.join(work, "src", project), "w") as fh:
            fh.write(final_project if seen_settings[0] or not start_project else start_project)

    def write():
        write_project()
        for p, st in states.items():
            full = os.path.join(work, "src", p)
            if st.exists and st.final is not None or (st.exists and p in deleted):
                os.makedirs(os.path.dirname(full), exist_ok=True)
                with open(full, "w") as fh:
                    fh.write("\n".join(st.lines()))
            elif os.path.exists(full):
                os.remove(full)

    def xcodebuild():
        r = subprocess.run(
            ["xcodebuild", "-project", "AVCam.xcodeproj", "-scheme", "AVCam",
             "-destination", "generic/platform=iOS Simulator",
             "-derivedDataPath", os.path.join(work, "dd"), "CODE_SIGNING_ALLOWED=NO", "build"],
            cwd=os.path.join(work, "src"), capture_output=True, text=True)
        errors = sorted(set(re.findall(r"^(/.*?error: .*)$", r.stdout, re.M)))
        errors = [e.replace(os.path.join(work, "src") + "/", "") for e in errors]
        return "BUILD SUCCEEDED" in r.stdout, errors

    for section in page["sections"]:
        text = []
        for item in section["items"]:
            if item["type"] == "step":
                if item.get("block") == "settings" and re.search(r"[Tt]arget", item["instruction"]):
                    seen_settings[0] = True
                for st in states.values():
                    st.apply(item)
                # A step that tells the learner to delete a file.
                for p in deleted:
                    if os.path.basename(p) in item["instruction"] and re.search(r"[Dd]elete|[Rr]emove", item["instruction"]):
                        states[p].exists = False
                text.append(item["instruction"] + " " + item.get("caption", ""))
            else:
                text.append(item.get("text", ""))
        claims = bool(CLAIM.search(" ".join(text[-3:])))
        ok, errors = (None, [])
        if build:
            write()
            ok, errors = xcodebuild()
        # git and the page can disagree about WHICH closing brace is new. Then the replay has a
        # brace too few or too many between two sections, although the learner's file is correct.
        brace = bool(errors) and all(re.search(r"[Ee]xpected '}'|only valid at file scope|[Ee]xtraneous '}'|expected declaration", e) for e in errors)
        results.append({"section": section["number"], "title": section["title"], "claims": claims, "ok": ok, "brace": brace, "errors": errors[:6]})

    for p in deleted:
        states[p].exists = False
    diffs = []
    for p, st in states.items():
        if st.final is None:
            continue
        if normal(st.lines()) != normal(st.final):
            d = [l for l in difflib.unified_diff(normal(st.lines()), normal(st.final), "replay", "branch", lineterm="", n=0)][2:8]
            diffs.append((p, d))
    return results, diffs


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    build = "--no-build" not in sys.argv
    pages = json.load(open(args[0]))
    only = set(args[1:])
    report = ["# Replay report", "", "Each tutorial page is applied step by step to its start branch. The app is built at the end of each section.", ""]
    for page in pages:
        if only and page["slug"] not in only:
            continue
        results, diffs = replay(page, build)
        report.append(f"## {page['slug']} ({page['startBranch']} to {page['branch']})")
        report.append("")
        report.append("| Section | Page says it builds | Build |")
        report.append("|---|---|---|")
        for r in results:
            state = "not run" if r["ok"] is None else ("ok" if r["ok"] else ("unclear (brace position)" if r.get("brace") else "FAILS"))
            report.append(f"| {r['section']}. {r['title']} | {'yes' if r['claims'] else 'no'} | {state} |")
            print(f"{page['slug']:12} s{r['section']:<2} claims={'Y' if r['claims'] else 'n'} build={state}", flush=True)
        for r in results:
            if r["ok"] is False:
                report.append("")
                report.append(f"Errors after section {r['section']}:")
                report.extend(f"- `{e}`" for e in r["errors"])
        report.append("")
        if diffs:
            report.append("End state is DIFFERENT from the branch:")
            for p, d in diffs:
                report.append(f"- `{p}`: " + " / ".join(f"`{x}`" for x in d))
                print(f"{page['slug']:12} END STATE DIFFERS {p}", flush=True)
        else:
            report.append("End state: equal to the branch (empty lines ignored).")
            print(f"{page['slug']:12} end state equals the branch", flush=True)
        report.append("")
    os.makedirs(os.path.join(SITE, "docs", "review"), exist_ok=True)
    name = "replay.md" if not only else "replay-partial.md"
    open(os.path.join(SITE, "docs", "review", name), "w").write("\n".join(report) + "\n")


if __name__ == "__main__":
    main()
