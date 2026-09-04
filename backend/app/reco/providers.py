"""AI recommendation providers.

The ``get_provider`` factory reads ``config.AI_PROVIDER`` and returns a
concrete provider.  ``RuleProvider`` wraps the existing deterministic engine;
``OpenAIProvider`` is a stub that will call the OpenAI API once configured.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from app.core.config import settings
from app.engine import recommend as engine_recommend
from app.schemas import Recommendation


class BaseProvider(ABC):
    """Abstract base for all recommendation providers."""

    @abstractmethod
    def recommend(
        self,
        destinations: list[dict[str, Any]],
        filters: dict[str, Any],
        history: list[dict[str, Any]] | None = None,
        preferences: list[dict[str, Any]] | None = None,
    ) -> list[Recommendation]:
        """Return ranked recommendations for the given context."""


class RuleProvider(BaseProvider):
    """Wraps the existing rule-based engine."""

    def recommend(
        self,
        destinations: list[dict[str, Any]],
        filters: dict[str, Any],
        history: list[dict[str, Any]] | None = None,
        preferences: list[dict[str, Any]] | None = None,
    ) -> list[Recommendation]:
        raw = engine_recommend(destinations, filters, history, preferences)
        return [
            Recommendation(
                destination={
                    "id": r["destination"]["id"],
                    "name": r["destination"]["name"],
                    "country": r["destination"].get("country"),
                    "region": r["destination"].get("region"),
                    "description": r["destination"].get("description"),
                    "best_season": r["destination"].get("best_season"),
                    "tags": r["destination"].get("tags", []),
                    "image_url": None,
                },
                score=r["score"],
                reason=r.get("reasons", [None])[0] if r.get("reasons") else None,
                matched_interests=r.get("matched_interests", []),
            )
            for r in raw
        ]


class OpenAIProvider(BaseProvider):
    """Stub – real implementation blocked until API key + flag are wired.

    TODO(T10):  Integrate openai SDK, pass api_key from config, build prompt
    from filters/history/preferences, parse completion into Recommendations.
    Falls back to ``RuleProvider`` when called before implementation is ready.
    """

    def __init__(self) -> None:
        self._fallback = RuleProvider()

    def recommend(
        self,
        destinations: list[dict[str, Any]],
        filters: dict[str, Any],
        history: list[dict[str, Any]] | None = None,
        preferences: list[dict[str, Any]] | None = None,
    ) -> list[Recommendation]:
        raise NotImplementedError(
            "OpenAI provider is not yet implemented. "
            "Set AI_PROVIDER=rule or wait for T10 integration."
        )


_PROVIDER_MAP: dict[str, type[BaseProvider]] = {
    "rule": RuleProvider,
    "openai": OpenAIProvider,
}


def get_provider(name: str | None = None) -> BaseProvider:
    """Return an instance of the requested provider.

    Falls back to ``RuleProvider`` for unknown names.
    """
    provider_name = name or settings.AI_PROVIDER
    cls = _PROVIDER_MAP.get(provider_name, RuleProvider)
    return cls()
