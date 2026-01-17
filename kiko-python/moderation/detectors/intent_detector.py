"""
Intent Detector using OpenAI Moderation API + Regex patterns
Lightweight replacement for transformer-based classification
"""
import re
from moderation.models import moderation_models


class IntentDetector:
    def __init__(self):
        # High-risk patterns for critical categories (regex backup)
        self.critical_patterns = [
            # Violence & Terrorism
            r"kill|murder|bomb|terrorist|attack|suicide|shooting|poison|stab|hitman|kidnap|hostage|assault",
            r"自杀|自残|杀人|爆炸|恐怖袭击|开枪|毒药|杀掉|弄死|绑架|人质|恐怖分子|屠杀",
            
            # Illegal Acts & Crimes
            r"stolen|drugs|trafficking|child abuse|smuggle|malware|virus|hack|illegal|fake docs",
            r"毒品|洗钱|军火|色情|诱拐|走私|贩毒|非法交易|强奸|病毒感染|黑客",
            
            # Social Engineering & Scams
            r"lottery|airdrop|claim.*reward|winner|gift for you|private key|seed phrase|mnemonic|secret key",
            r"中奖|空投|输入助记词|输入私钥|告诉我密码|客服|领取|账号异常|发给我.*助记词|助记词.*发|私钥.*发|发.*私钥"
        ]
        
        # Safe contexts (whitelists) - educational content about security
        self.safe_patterns = [
            r"(never|don't|do not|avoid|keep|store|safe|secure|offline).*(private|seed|mnemonic|password|secret|key)",
            r"(不要|别|严禁|从不|保护|保管|储存).*(泄露|透露|给|分享|发给|告诉).*(助记词|私钥|密码)",
        ]

    def detect(self, text: str) -> dict:
        """
        Detect intent using OpenAI Moderation API + regex fallback.
        Returns risk assessment compatible with existing router.
        """
        text_lower = text.lower()
        
        # 1. Use OpenAI Moderation API (primary)
        api_result = moderation_models.classify_input(text)
        
        # 2. Regex-based critical pattern check (backup)
        critical_hit = False
        for pattern in self.critical_patterns:
            if re.search(pattern, text_lower, re.IGNORECASE):
                critical_hit = True
                break
        
        # 3. Check safe patterns (whitelist bypass)
        if critical_hit:
            for safe_pattern in self.safe_patterns:
                if re.search(safe_pattern, text_lower, re.IGNORECASE):
                    critical_hit = False
                    break
        
        # 4. Determine risk level
        api_flagged = api_result.get("flagged", False)
        scores = api_result.get("scores", {})
        
        # Check for high-risk categories from OpenAI
        is_high_risk = (
            api_flagged or
            scores.get("violence", 0) > 0.7 or
            scores.get("harassment", 0) > 0.7 or
            scores.get("self-harm", 0) > 0.5 or
            scores.get("sexual/minors", 0) > 0.3 or
            critical_hit
        )
        
        is_medium_risk = (
            scores.get("hate", 0) > 0.4 or
            scores.get("harassment", 0) > 0.4 or
            scores.get("violence", 0) > 0.4
        )
        
        risk_level = "low"
        if is_high_risk:
            risk_level = "high"
        elif is_medium_risk:
            risk_level = "medium"
        
        return {
            "risk_level": risk_level,
            "critical_hit": critical_hit,
            "is_toxic": api_flagged,
            "api_flagged": api_flagged,
            "categories": api_result.get("categories", {}),
            "scores": scores,
            "moderate_hits": []  # Simplified - no longer tracking individual keywords
        }


intent_detector = IntentDetector()
