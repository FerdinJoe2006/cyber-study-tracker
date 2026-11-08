#!/usr/bin/env python3
"""
roadmap_to_seed.py - convert the Cybersecurity Roadmap 2027 into data/seed.json

USAGE
    python tools/roadmap_to_seed.py "path/to/Cybersecurity_Roadmap_2027.pdf"
    python tools/roadmap_to_seed.py roadmap.txt            # already-extracted text also works

    Optional:  -o data/seed.json   (output path)

WHAT IT DOES
    1. If the input is a PDF, extracts its text with PyMuPDF (pip install pymupdf).
       If the input is a .txt file, uses the text as is.
    2. Parses the day-by-day plan (section 8), the phase table, projects,
       certifications and progress-tracker milestones.
    3. Writes one JSON file the app loads on first run.

Day "type" is derived from the day text and weekday (edit TYPE RULES below to tune):
    exam     text starts with EXAM DAY / Take ... / Begin the ... / Exam day / Full-length practice exam
    project  text starts with "Project N"
    lab      Saturday (or text starts with "Lab")
    review   text contains "review" (weekly / monthly review)
    rest     text starts with "Rest"
    study    everything else
"""
import argparse
import json
import re
import sys
from datetime import date, timedelta
from pathlib import Path

YEAR = 2027
MONTHS = {m: i for i, m in enumerate(
    ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], 1)}
DOW = ("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")

DATE_LINE = re.compile(r"^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) (\d{2}) ([A-Z][a-z]{2})$")
DAY_LINE = re.compile(r"^Day (\d+)$")
WEEK_LINE = re.compile(r"^Week (\d+) \| (.+?) \| (.+)$")
NOISE = re.compile(r"^(Cybersecurity Roadmap 2027 - Personal & Confidential|Page \d+|=====PAGE \d+=====)$")


def load_text(path: Path) -> str:
    """Return the roadmap as plain text (PDF -> text via PyMuPDF)."""
    if path.suffix.lower() == ".pdf":
        try:
            import pymupdf  # type: ignore
        except ImportError:
            try:
                import fitz as pymupdf  # type: ignore
            except ImportError:
                sys.exit("PDF input needs PyMuPDF:  pip install pymupdf   (or pass a .txt file)")
        doc = pymupdf.open(str(path))
        return "\n".join(f"=====PAGE {i + 1}=====\n" + p.get_text() for i, p in enumerate(doc))
    return path.read_text(encoding="utf-8")


def iso(d: int, mon: str) -> str:
    return date(YEAR, MONTHS[mon], d).isoformat()


def lines_between(lines, start_pat, end_pat):
    """Lines after the first line matching start_pat, up to (not including) the next end_pat."""
    out, on = [], False
    for ln in lines:
        if not on and re.search(start_pat, ln):
            on = True
            continue
        if on and end_pat and re.search(end_pat, ln):
            break
        if on and not NOISE.match(ln):
            out.append(ln)
    return out


# --------------------------------------------------------------------------- phases
def parse_phases(lines):
    """Phase table: '1. Foundations' / '01 Jan - 28 Feb' / goal lines / output lines."""
    block = lines_between(lines, r"^Main output$", r"^Monthly milestones$|^Page 3$")
    phases, cur = [], None
    for ln in block:
        m = re.match(r"^(\d)\. (.+)$", ln)
        if m and int(m.group(1)) == len(phases) + 1:
            cur = {"num": int(m.group(1)), "name": m.group(2), "_rest": []}
            phases.append(cur)
        elif cur is not None:
            cur["_rest"].append(ln)
    for p in phases:
        rest = p.pop("_rest")
        dm = re.match(r"^(\d{2}) ([A-Z][a-z]{2}) - (\d{2}) ([A-Z][a-z]{2})$", rest[0])
        p["start"], p["end"] = iso(int(dm[1]), dm[2]), iso(int(dm[3]), dm[4])
        p["text"] = " ".join(rest[1:])  # goal + main output, joined for reference
    return phases


# --------------------------------------------------------------------------- projects
def parse_projects(lines):
    block = lines_between(lines, r"^What you produce$", r"^Optional extras")
    projects, i = [], 0
    while i < len(block):
        if re.fullmatch(r"\d{1,2}", block[i]) and i + 2 < len(block) and re.fullmatch(r"\d{1,2}", block[i + 1]):
            num, week, name = int(block[i]), int(block[i + 1]), block[i + 2]
            i += 3
            deliv = []
            while i < len(block) and not (re.fullmatch(r"\d{1,2}", block[i]) and i + 1 < len(block) and re.fullmatch(r"\d{1,2}", block[i + 1])):
                deliv.append(block[i])
                i += 1
            projects.append({"num": num, "week": week, "name": name,
                             "deliverable": " ".join(deliv), "github": "", "status": "not-started"})
        else:
            i += 1
    return projects


# --------------------------------------------------------------------------- certifications
CERT_DEFS = [
    # id, display name, how to find the cost/target text in the PDF, exam-day regex in the day plan
    ("isc2cc",  "ISC2 Certified in Cybersecurity (CC)", r"Take the ISC2 Certified"),
    ("secplus", "CompTIA Security+",                    r"EXAM DAY: take CompTIA Security\+"),
    ("ejpt",    "INE eJPT",                             r"EXAM DAY: take eJPT"),
    ("sc900",   "Microsoft SC-900 (or AWS CCP)",        r"Take Microsoft SC-900"),
    ("cllm",    "Red Team Leaders CLLMSP / CLLMSE",     r"Take CLLMSP"),
    ("pnpt",    "TCM PNPT (or HTB CPTS)",               r"Begin the PNPT"),
]


def parse_certs(lines, days):
    """Cert table rows are matched by name; exam date is taken from the matching day in the plan."""
    block = lines_between(lines, r"^Approx\. cost \(verify\)$", r"^Other recognized bodies")
    text = "\n".join(block)
    targets = {
        "isc2cc": "Week 8 (Feb)", "secplus": "Fri 23 Apr", "ejpt": "Fri 09 Jul",
        "sc900": "Sat 21 Aug", "cllm": "Sep (week 36)", "pnpt": "Oct (week 41)",
    }
    costs = {
        "isc2cc": "Often free or low", "secplus": "about USD 400", "ejpt": "about USD 250",
        "sc900": "about USD 100 (regional pricing lower)", "cllm": "Coupon price or low", "pnpt": "about USD 400",
    }
    # sanity check: warn if the PDF no longer contains the expected target text
    for key, tgt in targets.items():
        if tgt.split(" (")[0] not in text:
            print(f"  warning: target text '{tgt}' for {key} not found in the cert table", file=sys.stderr)
    certs = []
    for cid, name, pat in CERT_DEFS:
        hit = next((d for d in days if re.search(pat, d["task"])), None)
        certs.append({
            "id": cid, "name": name, "targetLabel": targets[cid],
            # targetDay = roadmap day number of the exam. The app turns it into a calendar date
            # from YOUR start date. targetDate stays empty (optional manual override).
            "targetDay": hit["day"] if hit else 0, "targetDate": "", "examDate": "", "status": "planned",
            "cost": costs[cid], "score": "", "notes": "",
        })
    return certs


# --------------------------------------------------------------------------- milestones
def parse_milestones(lines, days):
    block = lines_between(lines, r"^Target date$", r"^Ethics and legal rules$")
    day_of = {d["date"]: d["day"] for d in days}
    items, i = [], 0
    while i < len(block):
        if block[i] == "[ ]" and i + 2 < len(block):
            text, tgt = block[i + 1], block[i + 2]
            m = re.match(r"^(\d{2}) ([A-Z][a-z]{2})$", tgt)
            items.append({"id": len(items) + 1, "done": False, "milestone": text,
                          "target": tgt, "targetDay": day_of.get(iso(int(m[1]), m[2]), 0) if m else 0})
            i += 3
        else:
            i += 1
    return items


# --------------------------------------------------------------------------- day-by-day plan
def classify(task: str, dow: str) -> str:
    """TYPE RULES - edit here to change how days are classified."""
    if re.match(r"^(EXAM DAY|Take (?!a practice)|Begin the |Exam day|Full-length practice exam)", task):
        return "exam"
    if re.match(r"^Project \d+", task):
        return "project"
    if re.match(r"^Rest\b", task):
        return "rest"
    if dow == "Sat" or re.match(r"^Lab\b", task):
        return "lab"
    if "review" in task.lower():
        return "review"
    return "study"


def parse_days(lines, phases):
    block = lines_between(lines, r"^8\. Day-by-day plan", r"^9\. Progress tracker")
    days, week_no, week_title, week_range = [], None, "", ""
    i = 0
    while i < len(block):
        ln = block[i]
        wm = WEEK_LINE.match(ln)
        if wm:
            week_no, week_range, week_title = int(wm[1]), wm[2], wm[3]
            i += 1
            continue
        dm = DATE_LINE.match(ln)
        if dm and i + 1 < len(block) and DAY_LINE.match(block[i + 1]):
            dow, dd, mon = dm.groups()
            daynum = int(DAY_LINE.match(block[i + 1])[1])
            i += 2
            task = []
            while i < len(block) and not DATE_LINE.match(block[i]) and not WEEK_LINE.match(block[i]) \
                    and not block[i].startswith("Saturday rows are shaded"):
                task.append(block[i])
                i += 1
            d = iso(int(dd), mon)
            days.append({
                "date": d, "day": daynum, "dow": dow, "week": week_no, "weekTitle": week_title,
                "task": " ".join(task).strip(), "type": classify(" ".join(task).strip(), dow),
            })
            continue
        i += 1
    # phase label for every day
    for d in days:
        d["phase"] = next((p["num"] for p in phases if p["start"] <= d["date"] <= p["end"]), 0)
    return days


def load_cards():
    """Read tools/starter_cards.json and return card dicts (empty list if the file is missing)."""
    f = Path(__file__).resolve().parent / "starter_cards.json"
    if not f.exists():
        return []
    return [{"week": w, "topic": t, "q": q, "a": a, "source": "starter"} for w, t, q, a in json.loads(f.read_text(encoding="utf-8"))]


def validate(seed):
    days = seed["days"]
    problems = []
    if len(days) != 365:
        problems.append(f"expected 365 days, got {len(days)}")
    start = date(YEAR, 1, 1)
    for n, d in enumerate(days, 1):
        want = (start + timedelta(days=n - 1)).isoformat()
        if d["date"] != want or d["day"] != n:
            problems.append(f"day {n}: date {d['date']} / number {d['day']} (expected {want})")
            break
        if DOW[date.fromisoformat(d["date"]).weekday()] != d["dow"]:
            problems.append(f"{d['date']}: weekday label {d['dow']} is wrong")
            break
        if not d["task"]:
            problems.append(f"{d['date']}: empty task text")
            break
    if len(seed["phases"]) != 8:
        problems.append(f"expected 8 phases, got {len(seed['phases'])}")
    if len(seed["projects"]) != 12:
        problems.append(f"expected 12 projects, got {len(seed['projects'])}")
    return problems


def main():
    ap = argparse.ArgumentParser(description="Convert the roadmap PDF/text into seed.json")
    ap.add_argument("source", help="Cybersecurity_Roadmap_2027.pdf (or extracted .txt)")
    ap.add_argument("-o", "--out", default=str(Path(__file__).resolve().parent.parent / "data" / "seed.json"))
    args = ap.parse_args()

    text = load_text(Path(args.source))
    lines = [l.strip() for l in text.splitlines() if l.strip()]

    phases = parse_phases(lines)
    days = parse_days(lines, phases)
    seed = {
        "meta": {"title": "Cybersecurity Roadmap 2027", "planStart": f"{YEAR}-01-01", "planEnd": f"{YEAR}-12-31",
                 "source": Path(args.source).name},
        "phases": phases,
        "days": days,
        "projects": parse_projects(lines),
        "certs": parse_certs(lines, days),
        "milestones": parse_milestones(lines, days),
        # Starter flash-cards: written by hand per weekly theme (NOT taken from the PDF).
        # Edit tools/starter_cards.json: [week, topic, question, answer]
        "cards": load_cards(),
    }
    problems = validate(seed)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(seed, indent=1, ensure_ascii=False), encoding="utf-8")
    kinds = {}
    for d in days:
        kinds[d["type"]] = kinds.get(d["type"], 0) + 1
    print(f"wrote {out}")
    print(f"  days={len(days)} phases={len(phases)} projects={len(seed['projects'])} "
          f"certs={len(seed['certs'])} milestones={len(seed['milestones'])}")
    print(f"  day types: {kinds}")
    if problems:
        print("PROBLEMS:", *problems, sep="\n  - ", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
