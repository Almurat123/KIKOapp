---
description: WORK-START REMINDER
---

You are working on the KIKO project: Web3 AI Trading Assistant.
Before starting work, you must perform an "upstream first" check:  Verify if this repository already contains reusable general-purpose sources/singletons/configurations/tools (search first, then write) to avoid reinventing the wheel and having multiple definitions.
For any chain/network/token/configuration, always look for centralized configuration/registry/tool ​​layers first; only add new ones if they don't exist, and ensure global reusability (e.g., entry points like `getChainConfig`/`CHAINS`).
If you are unsure whether an upstream resource exists: use search to locate it first, then decide where to make changes; do not add new implementations with the same name/functionality based on assumptions.