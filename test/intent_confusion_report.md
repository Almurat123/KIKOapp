# Intent Confusion Report

- Total: 1000
- Correct: 1000
- Accuracy: 1

## Per-Label Metrics

- TRADING: precision=1, recall=1, tp=150, fp=0, fn=0
- MARKET_ANALYSIS: precision=1, recall=1, tp=300, fp=0, fn=0
- RISK_SCAN: precision=1, recall=1, tp=150, fp=0, fn=0
- SOCIAL_SENSING: precision=1, recall=1, tp=150, fp=0, fn=0
- COPY_TRADING: precision=1, recall=1, tp=125, fp=0, fn=0
- PREDICTION_MARKETS: precision=1, recall=1, tp=125, fp=0, fn=0
- GENERAL_CHAT: precision=0, recall=0, tp=0, fp=0, fn=0

## Confusion Matrix

| expected \/ predicted | TRADING | MARKET_ANALYSIS | RISK_SCAN | SOCIAL_SENSING | COPY_TRADING | PREDICTION_MARKETS | GENERAL_CHAT |
| --- | --- | --- | --- | --- | --- | --- |
| TRADING | 150 | 0 | 0 | 0 | 0 | 0 | 0 |
| MARKET_ANALYSIS | 0 | 300 | 0 | 0 | 0 | 0 | 0 |
| RISK_SCAN | 0 | 0 | 150 | 0 | 0 | 0 | 0 |
| SOCIAL_SENSING | 0 | 0 | 0 | 150 | 0 | 0 | 0 |
| COPY_TRADING | 0 | 0 | 0 | 0 | 125 | 0 | 0 |
| PREDICTION_MARKETS | 0 | 0 | 0 | 0 | 0 | 125 | 0 |
| GENERAL_CHAT | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Sample Errors (first 50)
