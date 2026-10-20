#!/usr/bin/env python3
"""Sync one edited draw.io question into the canonical lecture-01 JSON bank."""
import json
import re
import sys
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
DRAWIO = ROOT / "maps/questions/1.1.1.1.drawio"
BANK = ROOT / "tests/lecture-01-bank.json"
QUESTION_ID = "1.1.1.1"


def fields_from_drawio(path):
    root = ET.parse(path).getroot()
    diagrams = root.findall("diagram")
    if len(diagrams) != 1 or diagrams[0].find("mxGraphModel") is None:
        raise ValueError("Expected one uncompressed draw.io diagram")
    cells = {
        node.attrib["id"]: node.attrib.get("value", "")
        for node in diagrams[0].iter("mxCell")
        if "id" in node.attrib
    }
    needed = {"question", "explanation", "difficulty", "reference", "choice_1", "choice_2", "choice_3"}
    if not needed.issubset(cells):
        raise ValueError("Missing required editable fields: " + ", ".join(sorted(needed - cells.keys())))
    for field in needed:
        if "<" in cells[field] or ">" in cells[field]:
            raise ValueError("Use plain text only in editable field: " + field)
    return cells


def update():
    fields = fields_from_drawio(DRAWIO)
    data = json.loads(BANK.read_text(encoding="utf-8"))
    matches = [q for q in data["questions"] if q["id"] == QUESTION_ID]
    if len(matches) != 1:
        raise ValueError("Question ID missing or not unique")
    q = matches[0]
    choices, correct = [], []
    for i in range(1, 4):
        value = fields[f"choice_{i}"].strip()
        selected = bool(re.match(r"^[✓✔]\s*", value))
        value = re.sub(r"^[✓✔]\s*", "", value).strip()
        if not value:
            raise ValueError(f"Empty option {i}")
        choices.append({"id": str(i), "text": value})
        if selected:
            correct.append(str(i))
    if not correct:
        raise ValueError("Mark at least one correct option with ✓")
    level = fields["difficulty"].strip()
    if not re.fullmatch("[1-5]", level):
        raise ValueError("Difficulty must be an integer from 1 to 5")
    for key in ("question", "explanation", "reference"):
        if not fields[key].strip():
            raise ValueError("Empty " + key)
    if len(set(x["text"].casefold() for x in choices)) != len(choices):
        raise ValueError("Duplicate option texts")
    q.update({
        "question": fields["question"].strip(),
        "options": choices,
        "correct": correct,
        "explanation": fields["explanation"].strip(),
        "difficulty": int(level),
        "sourceParagraphs": fields["reference"].strip(),
        "status": "черновик — отредактирован в draw.io; требует содержательной приёмки"
    })
    data["editorialSync"] = {
        "source": "maps/questions/1.1.1.1.drawio",
        "mode": "question-prototype-v1",
        "questionId": QUESTION_ID
    }
    output = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    if BANK.read_text(encoding="utf-8") != output:
        BANK.write_text(output, encoding="utf-8")
        print("Updated", QUESTION_ID)
    else:
        print("No change", QUESTION_ID)


if __name__ == "__main__":
    try:
        update()
    except (ET.ParseError, ValueError, KeyError, OSError, json.JSONDecodeError) as error:
        print("SYNC ERROR:", error, file=sys.stderr)
        sys.exit(1)
