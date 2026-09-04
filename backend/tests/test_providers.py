"""Tests for app.reco.providers – provider dispatch and behaviour."""

from __future__ import annotations

from unittest.mock import patch

import pytest

from app.reco.providers import (
    BaseProvider,
    OpenAIProvider,
    RuleProvider,
    get_provider,
)


# ── factory dispatch ────────────────────────────────────────────────


class TestGetProvider:
    def test_default_is_rule(self) -> None:
        provider = get_provider()
        assert isinstance(provider, RuleProvider)

    def test_explicit_rule(self) -> None:
        assert isinstance(get_provider("rule"), RuleProvider)

    def test_explicit_openai(self) -> None:
        assert isinstance(get_provider("openai"), OpenAIProvider)

    def test_unknown_falls_back_to_rule(self) -> None:
        assert isinstance(get_provider("nonexistent"), RuleProvider)

    def test_env_flag_rule(self) -> None:
        with patch("app.reco.providers.settings") as mock_settings:
            mock_settings.AI_PROVIDER = "rule"
            assert isinstance(get_provider(), RuleProvider)

    def test_env_flag_openai(self) -> None:
        with patch("app.reco.providers.settings") as mock_settings:
            mock_settings.AI_PROVIDER = "openai"
            assert isinstance(get_provider(), OpenAIProvider)


# ── RuleProvider ────────────────────────────────────────────────────


class TestRuleProvider:
    def test_returns_list_of_recommendation(self) -> None:
        provider = RuleProvider()
        dests = [
            {
                "id": 1,
                "name": "Kyoto",
                "country": "Japan",
                "region": "East Asia",
                "description": "Temples",
                "best_season": "spring",
                "tags": ["culture"],
                "cost_level_1": 1,
                "cost_level_2": 2,
                "cost_level_3": 3,
                "cost_level_4": 4,
            }
        ]
        filters = {"start_date": "2026-04-01", "end_date": "2026-04-03"}
        results = provider.recommend(dests, filters)
        assert len(results) == 1
        assert results[0].destination.name == "Kyoto"
        assert isinstance(results[0].score, float)

    def test_empty_destinations(self) -> None:
        provider = RuleProvider()
        results = provider.recommend([], {"start_date": "2026-04-01", "end_date": "2026-04-03"})
        assert results == []


# ── OpenAIProvider ──────────────────────────────────────────────────


class TestOpenAIProvider:
    def test_not_implemented(self) -> None:
        provider = OpenAIProvider()
        with pytest.raises(NotImplementedError, match="not yet implemented"):
            provider.recommend([], {"start_date": "2026-04-01", "end_date": "2026-04-03"})


# ── ABC contract ────────────────────────────────────────────────────


class TestABC:
    def test_rule_is_subclass(self) -> None:
        assert issubclass(RuleProvider, BaseProvider)

    def test_openai_is_subclass(self) -> None:
        assert issubclass(OpenAIProvider, BaseProvider)

    def test_cannot_instantiate_abc(self) -> None:
        with pytest.raises(TypeError):
            BaseProvider()  # type: ignore[abstract]
