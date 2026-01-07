import re
from moderation.models import moderation_models

class IntentDetector:
    def __init__(self):
        # High-risk patterns for 100% target accuracy categories
        self.critical_patterns = [
            # Violence & Terrorism
            r"kill|murder|bomb|terrorist|attack|suicide|shooting|poison|stab|hitman|hitmen|kidnap|hostage|assault|death|die",
            r"自杀|自残|杀人|爆炸|恐怖袭击|开枪|毒药|杀掉|弄死|毙命|砍死|同归于尽|买凶|屠杀|绑架|人质|恐怖分子|去死|毙命",
            
            # Illegal Acts & Crimes
            r"stolen|drugs|trafficking|child abuse|smuggle|malware|virus|infect|hack|illegal|fake docs|fake documents",
            r"毒品|窃听|洗钱|军火|黑卡|色情|诱拐|走私|贩毒|违禁药品|非法交易|强奸|邪教|私藏枪支|病毒感染|黑进|窃取|非法入境|伪造文件|黑客",
            
            # Public Opinion & Social Unrest
            r"protest|riot|revolt|overthrow|uprising|boycott|insurrection|fake news|propaganda|genocide|voting machines|block.*highway|hate.*religious|hate message",
            r"游行|暴动|造反|封杀|煽动|示威|反政府|起义|搞事情|罢工|罢课|集会|变天|骚乱|造谣|维权|种族歧密|非法集会|冲击政府|广场聚集|攻击警察|围攻|攻击政府|政府网站",
            
            # Social Engineering & Scams (Strict)
            r"lottery|airdrop|claim.*reward|winner|gift for you|login|password|private key|seed phrase|mnemonic|secret key|link\.com|fake exchange",
            r"中奖|奖励|空投|输入助记词|输入私钥|告诉我密码|客服|领取|惊喜|假链接|账号异常|官方客服|登录页面"
        ]
        
        # Safe contexts (whitelists) - reused from sensitive_filter logic
        self.safe_patterns = [
            # English & Mixed Language variations
            r"(never|don't|do not|avoid|keep|store|storage|official).*(safe|secure|offline|share|give|tell|reveal|send|ask|provide|store|recovery).*(private|seed|mnemonic|password|secret|key|助记词|私钥|密码)",
            r"(private|seed|mnemonic|password|secret|key|助记词|私钥|密码).*(never|don't|do not|avoid|keep|store|storage|safe|secure|offline|share|give|tell|reveal|send|ask|provide|store|recovery)",
            r"(keep|store|storage|official).*(private|seed|mnemonic|password|secret|key|助记词|私钥|密码).*(safe|secure|offline|recovery)",
            # Chinese & Mixed Language variations
            r"(不要|别|严禁|从不|保护|保管|储存|官方).*(泄露|透露|给|分享|发给|告诉|询问|要求|提供|保管|记下|第一步).*(助记词|私钥|密码|mnemonic|seed|private|password|secret|key)",
            r"(助记词|私钥|密码|mnemonic|seed|private|password|secret|key).*(不要|别|严禁|从不|保护|保管|储存|泄露|透露|给|分享|发给|告诉|询问|要求|提供|保管|记下|第一步)"
        ]
        
        # Keywords that are sensitive but might have legitimate context
        self.moderate_keywords = [
            "conspiracy", "hate", "scam", "phishing", "leak", "stupid", "idiot", "garbage", "die", "bullshit",
            "洗脑", "阴谋论", "仇恨", "歧视", "骗局", "诈骗", "泄露", "垃圾", "去死", "滚蛋", "白痴", "脑残", "傻逼"
        ]

    def detect(self, text):
        results = moderation_models.classify_input(text)
        text_lower = text.lower()
        
        # Create a score map
        if isinstance(results, list) and isinstance(results[0], list):
            results = results[0]
        scores = {item['label']: item['score'] for item in results}
        
        # Thresholds for Roberta model - Extremely granular for safety
        identity_hate_score = scores.get('identity_hate', 0.0)
        threat_score = scores.get('threat', 0.0)
        severe_toxic_score = scores.get('severe_toxic', 0.0)
        toxic_score = scores.get('toxic', 0.0)
        insult_score = scores.get('insult', 0.0)
        
        # Identity hate and threats are zero-tolerance but need breathing room for tech terms
        is_high_risk_label = (
            identity_hate_score > 0.2 or   # Raised from 0.15
            threat_score > 0.2 or          # Raised from 0.15
            severe_toxic_score > 0.35 or   # Raised from 0.3
            toxic_score > 0.7 or           # Raised from 0.6
            insult_score > 0.7             # Raised from 0.6
        )
        
        # Regex-based critical hits
        critical_hit = False
        for pattern in self.critical_patterns:
            if re.search(pattern, text_lower, re.IGNORECASE):
                critical_hit = True
                break
        
        # Bypass for safe patterns (white-listing)
        if critical_hit:
            for safe_pattern in self.safe_patterns:
                if re.search(safe_pattern, text_lower, re.IGNORECASE):
                    critical_hit = False
                    break
        
        moderate_hits = [kw for kw in self.moderate_keywords if kw in text_lower]
        
        risk_level = "low"
        if is_high_risk_label or critical_hit:
            risk_level = "high"
        elif moderate_hits or (toxic_score > 0.4):
            risk_level = "medium"
            
        return {
            "risk_level": risk_level,
            "critical_hit": critical_hit,
            "moderate_hits": moderate_hits,
            "is_toxic": is_high_risk_label,
            "model_results": results
        }

intent_detector = IntentDetector()
