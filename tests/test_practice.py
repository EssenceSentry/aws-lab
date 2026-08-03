from aws_multi_account_lab.export import questions_to_anki_tsv
from aws_multi_account_lab.practice import QUESTIONS


def test_question_bank_is_valid_and_unique() -> None:
    ids = [question.id for question in QUESTIONS]
    assert len(ids) == len(set(ids))
    assert len(QUESTIONS) >= 10
    for question in QUESTIONS:
        question.validate()


def test_anki_export_contains_source_and_tags() -> None:
    output = questions_to_anki_tsv(QUESTIONS[:1])
    assert "Front\tBack\tTags\tSource" in output
    assert QUESTIONS[0].source.topic in output
    assert QUESTIONS[0].tags[0] in output
