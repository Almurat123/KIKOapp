from moderation.models import moderation_models

class IntentDetector:
    def __init__(self):
        # Keywords that strongly suggest malicious intent in Web3 context
        self.malicious_keywords = [
            "hack", "exploit", "drain", "steal", "scam", 
            "rug pull", "phishing", "bypass", "malware",
            "honeypot", "front-run", "sandwich attack"
        ]

    def detect(self, text):
        results = moderation_models.classify_input(text)
        
        # Logic for unitary/multilingual-toxic-xlm-roberta
        # Labels: toxic, severe_toxic, obscene, threat, insult, identity_hate
        
        # Flatten results if it's a list of lists (batch processing artifact)
        if isinstance(results, list) and isinstance(results[0], list):
            results = results[0]
            
        # Create a score map
        scores = {item['label']: item['score'] for item in results}
        
        # Thresholds
        identity_hate_score = scores.get('identity_hate', 0.0)
        threat_score = scores.get('threat', 0.0)
        severe_toxic_score = scores.get('severe_toxic', 0.0)
        toxic_score = scores.get('toxic', 0.0)
        
        # Strict check for dangerous religious/identity attacks
        is_dangerous = (
            identity_hate_score > 0.4 or  # Low threshold for identity/religious hate
            threat_score > 0.4 or         # Low threshold for threats
            severe_toxic_score > 0.6
        )
        
        keyword_hits = [kw for kw in self.malicious_keywords if kw in text.lower()]
        
        risk_level = "low"
        if is_dangerous or (toxic_score > 0.8):
            risk_level = "high"
        elif keyword_hits or (toxic_score > 0.5):
            risk_level = "medium"
            
        return {
            "risk_level": risk_level,
            "keyword_hits": keyword_hits,
            "model_results": results
        }

intent_detector = IntentDetector()
