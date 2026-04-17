"""
Lightweight Moderation Models using OpenAI Moderation API
Replaces heavy transformer models with free OpenAI API calls
"""
# CONTEXT MEMORY
# Updated: 2026-04-17
# Author: Rowan
# Reason: generated-image flows need strict text+image moderation without
#         changing ordinary chat's existing fail-open text moderation behavior.
# Goal: provide a dedicated fail-closed moderation path for generated image
#       prompts, reference images, generated outputs, and social publish gates.
# Owns: OpenAI moderation request construction and response normalization.
# Does Not Own: chat worker policy, generated image storage, or Farcaster
#               publication.
# Design Language:
# - ordinary chat moderation keeps its existing text-only compatibility path
# - generated-image moderation may pass text and image_url inputs together
# - generated-image moderation failures are unsafe by default
# - provider response shapes must be normalized before crossing the Python API
# Document Provenance:
# - Source: OpenAI Moderation guide and Moderations API OpenAPI spec
# - Kind: official API doc
# - Retrieved: 2026-04-17
# - Applied To: `omni-moderation-latest` text + image_url request shape
# - Verification: verified in docs and code
# See also:
# - /Users/almurat/KiKo/system-journal/INDEX.md
# - /Users/almurat/KiKo/system-journal/design-language/generated-image-safety.md
# - /Users/almurat/KiKo/system-journal/owner-map/generated-image-safety.md
# - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-generated-image-safety-gate.md
import os
import logging
from typing import Any
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def _model_value_to_dict(value: Any) -> dict:
    if value is None:
        return {}
    if isinstance(value, dict):
        return dict(value)
    if hasattr(value, "model_dump"):
        return value.model_dump()
    try:
        return dict(value)
    except Exception:
        return {}


class ModerationModels:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(ModerationModels, cls).__new__(cls)
            cls._instance.initialized = False
        return cls._instance

    def initialize(self):
        if self.initialized:
            return

        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            logger.error("OPENAI_API_KEY not found in environment")
            raise ValueError("OPENAI_API_KEY is required for moderation")

        self.client = OpenAI(api_key=api_key)
        self.initialized = True
        logger.info("✅ OpenAI Moderation API initialized (lightweight mode)")

    def _classify_payload(self, payload: Any, fail_closed: bool = False) -> dict:
        if not self.initialized:
            self.initialize()

        try:
            response = self.client.moderations.create(
                model="omni-moderation-latest",
                input=payload
            )

            result = response.results[0]
            result_payload = result.model_dump() if hasattr(result, "model_dump") else {}
            categories = _model_value_to_dict(getattr(result, "categories", None) or result_payload.get("categories"))
            scores = _model_value_to_dict(getattr(result, "category_scores", None) or result_payload.get("category_scores"))
            applied_input_types = _model_value_to_dict(
                getattr(result, "category_applied_input_types", None)
                or result_payload.get("category_applied_input_types")
            )

            return {
                "flagged": bool(getattr(result, "flagged", result_payload.get("flagged", False))),
                "categories": categories,
                "scores": scores,
                "category_applied_input_types": applied_input_types,
                "raw": result_payload
            }

        except Exception as e:
            logger.error(f"OpenAI Moderation API error: {e}")
            return {
                "flagged": bool(fail_closed),
                "categories": {"moderation_error": bool(fail_closed)},
                "scores": {},
                "category_applied_input_types": {},
                "error": str(e)
            }

    def classify_input(self, text: str) -> dict:
        """
        Classify input text using OpenAI Moderation API.
        Returns structured result compatible with existing detectors.
        """
        if not text or not text.strip():
            return {"flagged": False, "categories": {}, "scores": {}}

        return self._classify_payload(text, fail_closed=False)

    def classify_image_generation(self, text: str = "", image_urls: list[str] | None = None) -> dict:
        """
        Strict moderation for generated-image prompts, inputs, outputs, and
        publish gates. This intentionally fails closed and may include images.
        """
        normalized_text = (text or "").strip()
        normalized_image_urls = [
            str(url or "").strip()
            for url in (image_urls or [])
            if str(url or "").strip()
        ]
        payload: list[dict[str, Any]] = []
        if normalized_text:
            payload.append({"type": "text", "text": normalized_text})
        for url in normalized_image_urls:
            payload.append({"type": "image_url", "image_url": {"url": url}})

        if not payload:
            return {
                "flagged": True,
                "categories": {"empty_image_generation_moderation_input": True},
                "scores": {},
                "category_applied_input_types": {},
                "error": "empty_image_generation_moderation_input"
            }

        return self._classify_payload(payload, fail_closed=True)

    def verify_output(self, text: str, query_context: str = "") -> dict:
        """
        Verify LLM output using same moderation API.
        """
        if not text or not text.strip():
            return {"safe": True, "flagged": False, "status": "skipped_empty"}

        result = self.classify_input(text)
        
        return {
            "safe": not result.get("flagged", False),
            "flagged": result.get("flagged", False),
            "categories": result.get("categories", {}),
            "scores": result.get("scores", {})
        }


# Singleton instance
moderation_models = ModerationModels()
