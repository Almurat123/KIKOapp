class SensitiveFilter:
    def __init__(self):
        # List of sensitive keywords that should be blocked
        # This list can be expanded or integrated with a DB
        self.sensitive_keywords = [
            # Personal Info
            "private key", "seed phrase", "mnemonic", 
            "password", "secret key",
            
            # Illegal/Malicious
            "bypass security", "sql injection", "ddos",
            "dark web", "human trafficking", "illegal drugs"
        ]

    def filter(self, text: str) -> bool:
        """
        Returns True if sensitive content is detected, False otherwise.
        """
        text_lower = text.lower()
        for keyword in self.sensitive_keywords:
            if keyword in text_lower:
                return True
        return False

sensitive_filter = SensitiveFilter()
