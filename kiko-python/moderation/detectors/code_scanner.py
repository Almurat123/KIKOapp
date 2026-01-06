import re

class CodeScanner:
    def __init__(self):
        # Patterns that might indicate malicious code injection
        self.dangerous_patterns = [
            r"eval\s*\(",
            r"exec\s*\(",
            r"base64\.b64decode",
            r"subprocess\.",
            r"os\.system",
            r"<script.*?>",
            r"document\.cookie",
            r"window\.location"
        ]

    def scan(self, text: str) -> bool:
        """
        Returns True if dangerous code patterns are detected, False otherwise.
        """
        for pattern in self.dangerous_patterns:
            if re.search(pattern, text, re.IGNORECASE):
                return True
        return False

code_scanner = CodeScanner()
