#!/usr/bin/env python3
"""Builds the app at the state after a step of a tutorial page, runs it in the Simulator, and saves screenshots.

Usage:  node src/dump-steps.mjs > steps.json
        python3 tools/capture.py steps.json <slug> <section>.<step> <name> [action ...]
Actions: wait:<seconds>  shot:<suffix>
        python3 tools/capture.py steps.json shot <name>      (a screenshot of the app that runs now)
Example: python3 tools/capture.py steps.json ch02-build 4.5 ch02-s4-5 wait:8 shot:a
Result:  content/images/<name>-<suffix>.jpg (reduced size). Needs SimCam with image sources.
Environment: SIM (simulator udid), REPLAY_DIR (work folder), APP_REPO.
"""
import json, os, re, subprocess, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import replay as R

SIM = os.environ.get("SIM", "97435DB5-37B7-46CC-B831-6F07D978DF2A")
BUNDLE = "com.karolkakol.AVCam"
IMAGES = os.path.join(R.SITE, "content", "images")


def state_after(page, section_no, step_no):
    """The replay state of all Swift files after the given step (1-based numbers)."""
    start, branch = page["startBranch"], page["branch"]
    R.START, R.BRANCH = start, branch
    paths = sorted(set(R.swift_files(start)) | set(R.swift_files(branch)))
    states = {p: R.FileState(p, R.show(start, p), R.show(branch, p)) for p in paths}
    seen_target = False
    for section in page["sections"]:
        n = 0
        for item in section["items"]:
            if item["type"] != "step":
                continue
            n += 1
            if item.get("block") == "settings" and re.search(r"[Tt]arget", item["instruction"]):
                seen_target = True
            for st in states.values():
                st.apply(item)
            if section["number"] == section_no and n == step_no:
                return states, seen_target
    raise SystemExit(f"No step {section_no}.{step_no} on {page['slug']}")


def write_state(page, states, seen_target):
    work = os.path.join(R.WORK, "capture-" + page["slug"])
    src = os.path.join(work, "src")
    subprocess.run(["rm", "-rf", src]); os.makedirs(src)
    tar = subprocess.Popen(["git", "-C", R.APP, "archive", page["branch"]], stdout=subprocess.PIPE)
    subprocess.run(["tar", "-x", "-C", src], stdin=tar.stdout, check=True)
    project = "AVCam.xcodeproj/project.pbxproj"
    has_target_step = any(i["type"] == "step" and i.get("block") == "settings" and re.search(r"[Tt]arget", i["instruction"])
                          for sec in page["sections"] for i in sec["items"])
    if has_target_step and not seen_target:
        with open(os.path.join(src, project), "w") as fh:
            fh.write(R.git("show", f"{page['startBranch']}:{project}").stdout)
    for p, st in states.items():
        full = os.path.join(src, p)
        if st.exists and st.final is not None:
            os.makedirs(os.path.dirname(full), exist_ok=True)
            with open(full, "w") as fh:
                fh.write("\n".join(st.lines()))
        elif os.path.exists(full):
            os.remove(full)
    return work


def build_and_launch(work):
    dd = os.path.join(work, "dd")
    r = subprocess.run(["xcodebuild", "-project", "AVCam.xcodeproj", "-scheme", "AVCam", "-destination", f"id={SIM}",
                        "-derivedDataPath", dd, "-quiet", "build"], cwd=os.path.join(work, "src"), capture_output=True, text=True)
    if r.returncode != 0:
        errors = sorted(set(re.findall(r"^(/.*?error: .*)$", r.stdout + r.stderr, re.M)))
        raise SystemExit("Build failed:\n" + "\n".join(errors[:8]))
    app = os.path.join(dd, "Build", "Products", "Debug-iphonesimulator", "AVCam.app")
    subprocess.run(["xcrun", "simctl", "terminate", SIM, BUNDLE], capture_output=True)
    subprocess.run(["xcrun", "simctl", "install", SIM, app], check=True)
    subprocess.run(["xcrun", "simctl", "launch", SIM, BUNDLE], check=True, capture_output=True)


def shot(name):
    os.makedirs(IMAGES, exist_ok=True)
    raw = os.path.join(R.WORK, "shot.png")
    subprocess.run(["xcrun", "simctl", "io", SIM, "screenshot", raw], check=True, capture_output=True)
    out = os.path.join(IMAGES, name + ".jpg")
    subprocess.run(["sips", "-s", "format", "jpeg", "-s", "formatOptions", "82", "-Z", "900", raw, "--out", out], check=True, capture_output=True)
    print("saved", os.path.relpath(out, R.SITE), os.path.getsize(out) // 1024, "KB")


def tap(x, y):
    raise SystemExit("simctl cannot tap. Take the first shot here, then tap with the simulator tool and run `capture.py steps.json shot <name>`.")


def main():
    steps = json.load(open(sys.argv[1]))
    if sys.argv[2] == "shot":          # only a screenshot of the running app
        shot(sys.argv[3]); return
    page = next(p for p in steps if p["slug"] == sys.argv[2])
    sec, step = (int(x) for x in sys.argv[3].split("."))
    name = sys.argv[4]
    actions = sys.argv[5:]
    states, seen_target = state_after(page, sec, step)
    work = write_state(page, states, seen_target)
    build_and_launch(work)
    for a in actions:
        kind, _, arg = a.partition(":")
        if kind == "wait":
            time.sleep(float(arg))
        elif kind == "shot":
            shot(f"{name}-{arg}" if arg else name)
        elif kind == "tap":
            x, y = arg.split(",")
            tap(x, y)


if __name__ == "__main__":
    main()
