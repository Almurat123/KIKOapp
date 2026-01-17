"""
Lightweight Moderation Models using OpenAI Moderation API
Replaces heavy transformer models with free OpenAI API calls
"""
import os
import logging
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


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

    def classify_input(self, text: str) -> dict:
        """
        Classify input text using OpenAI Moderation API.
        Returns structured result compatible with existing detectors.
        """
        if not text or not text.strip():
            return {"flagged": False, "categories": {}, "scores": {}}

        if not self.initialized:
            self.initialize()

        try:
            response = self.client.moderations.create(
                model="omni-moderation-latest",
                input=text
            )

            result = response.results[0]
            
            # Convert to format compatible with existing code
            categories = {}
            scores = {}
            
            for category, flagged in result.categories:
                categories[category] = flagged
                
            for category, score in result.category_scores:
                scores[category] = score

            return {
                "flagged": result.flagged,
                "categories": dict(result.categories),
                "scores": dict(result.category_scores),
                "raw": result
            }

        except Exception as e:
            logger.error(f"OpenAI Moderation API error: {e}")
            # Fail-safe: return not flagged on API error
            return {"flagged": False, "categories": {}, "scores": {}, "error": str(e)}

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
