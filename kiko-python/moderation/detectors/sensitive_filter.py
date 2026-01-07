import re

class SensitiveFilter:
    def __init__(self):
        # Keywords that should be blocked unless in a safe context
        self.sensitive_keywords = [
            # Personal Info (English & Chinese)
            "private key", "seed phrase", "mnemonic", 
            "password", "secret key",
            "私钥", "助记词", "密码", "秘钥",
            
            # Illegal/Malicious
            "bypass security", "sql injection", "ddos",
            "dark web", "human trafficking", "illegal drugs",
            "绕过安全", "注入攻击", "暗网", "人口贩卖", "毒品交易"
        ]
        
        # Safe contexts (whitelists) that allow mention of sensitive terms
        self.safe_patterns = [
            # English & Mixed Language variations
            r"(never|don't|do not|avoid|keep|store|storage|official).*(safe|secure|offline|share|give|tell|reveal|send|ask|provide|store|recovery).*(private|seed|mnemonic|password|secret|key|助记词|私钥|密码)",
            r"(private|seed|mnemonic|password|secret|key|助记词|私钥|密码).*(never|don't|do not|avoid|keep|store|storage|safe|secure|offline|share|give|tell|reveal|send|ask|provide|store|recovery)",
            r"(keep|store|storage|official).*(private|seed|mnemonic|password|secret|key|助记词|私钥|密码).*(safe|secure|offline|recovery)",
            # Chinese & Mixed Language variations
            r"(不要|别|严禁|从不|保护|保管|储存|官方).*(泄露|透露|给|分享|发给|告诉|询问|要求|提供|保管|记下|第一步).*(助记词|私钥|密码|mnemonic|seed|private|password|secret|key)",
            r"(助记词|私钥|密码|mnemonic|seed|private|password|secret|key).*(不要|别|严禁|从不|保护|保管|储存|泄露|透露|给|分享|发给|告诉|询问|要求|提供|保管|记下|第一步)"
        ]

    def filter(self, text: str) -> bool:
        """
        Returns True if sensitive content is detected and NOT in a safe context.
        """
        text_lower = text.lower()
        
        # Check if any sensitive keyword is present
        hit = False
        hit_keyword = ""
        for keyword in self.sensitive_keywords:
            if keyword in text_lower:
                hit = True
                hit_keyword = keyword
                break
        
        if not hit:
            return False
            
        # If hit, check if it's within a safe pattern
        for pattern in self.safe_patterns:
            if re.search(pattern, text_lower):
                # If we hit a safe pattern, we allow the message
                return False
                
        return True

sensitive_filter = SensitiveFilter()
