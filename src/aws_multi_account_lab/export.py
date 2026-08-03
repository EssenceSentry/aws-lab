from __future__ import annotations

import csv
import io
from collections.abc import Iterable

from aws_multi_account_lab.models import PracticeQuestion


def questions_to_anki_tsv(questions: Iterable[PracticeQuestion]) -> str:
    output = io.StringIO()
    writer = csv.writer(output, delimiter="\t", lineterminator="\n")
    writer.writerow(("Front", "Back", "Tags", "Source"))
    for question in questions:
        answer = question.options[question.correct_index]
        back = f"{answer}\n\n{question.explanation}"
        writer.writerow(
            (
                question.prompt,
                back,
                " ".join(question.tags),
                question.source.label,
            )
        )
    return output.getvalue()
