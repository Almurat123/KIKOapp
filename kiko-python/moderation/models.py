import torch
from transformers import pipeline, AutoModelForSequenceClassification, AutoTokenizer, GPT2LMHeadModel, GPT2Tokenizer
import logging
import os
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
        
        device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info(f"Using device: {device}")

        # 1. Input Classifier (Multilingual Toxic BERT)
        # Using a model specialized for toxicity, threats, and identity hate (including religion)
        input_model_name = "unitary/multilingual-toxic-xlm-roberta"
        logger.info(f"Loading input model: {input_model_name}")
        
        # Explicitly load tokenizer with use_fast=False to avoid transformers crash
        tokenizer = AutoTokenizer.from_pretrained(input_model_name, use_fast=False)
        
        self.input_classifier = pipeline(
            "text-classification", 
            model=input_model_name, 
            tokenizer=tokenizer,
            device=device,
            top_k=None  # Return scores for all labels
        )

        # 2. Output Verifier 
        # Output verification model removed as per user request
        self.output_tokenizer = None
        self.output_model = None

        self.initialized = True
        logger.info("Moderation models initialized successfully")

    def classify_input(self, text):
        """Classifies input text for malicious intent or toxicity."""
        # Truncate to avoid model context limits (DistilBERT is 512)
        results = self.input_classifier(text, truncation=True, max_length=512)
        # Simplified: SST-2 gives POSITIVE/NEGATIVE. 
        # In a real scenario, we'd use a dedicated moderation model.
        return results

    def verify_output(self, text, query_context=""):
        """Verify LLM output using GPT-2. 
        Can be used to check perplexity or compare with original query.
        """
        # Return safe default for empty input
        if not text or not text.strip():
             return {"perplexity": 0.0, "loss": 0.0, "status": "skipped_empty"}

        if not self.initialized:
            self.initialize()
            
        if not hasattr(self, 'output_tokenizer'):
            # Fallback if initialization failed specifically for output model
            return {"perplexity": 0.0, "loss": 0.0, "status": "skipped_init_failed"}

        # Reuse the input classifier for output verification (Lightweight & Efficient)
        # It's the same safety standard: we don't want the AI to output hate speech either.
        
        results = self.input_classifier(text)
        
        # Logic for unitary/multilingual-toxic-xlm-roberta
        # Flatten results if it's a list of lists
        if isinstance(results, list) and isinstance(results[0], list):
            results = results[0]
            
        scores = {item['label']: item['score'] for item in results}
        
        # Same strict thresholds
        identity_hate_score = scores.get('identity_hate', 0.0)
        threat_score = scores.get('threat', 0.0)
        severe_toxic_score = scores.get('severe_toxic', 0.0)
        
        is_dangerous = (
            identity_hate_score > 0.4 or 
            threat_score > 0.4 or 
            severe_toxic_score > 0.6
        )
        
        return {
            "safe": not is_dangerous,
            "scores": scores,
            "flagged": is_dangerous
        }

# Singleton instance
moderation_models = ModerationModels()
