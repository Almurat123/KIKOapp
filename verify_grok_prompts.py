#!/usr/bin/env python3
"""
Static Analysis: Verify Grok Prompt Integration

This script analyzes the code to verify that:
1. Python Grok service receives system prompts from Node.js
2. Python does NOT override the Node.js prompts
3. All key modules are present in Node.js prompts
"""

import os
import re

def check_python_router():
    """Check Python router.py for prompt handling"""
    print("🔍 Checking Python Grok Service (router.py)\n")
    
    router_path = "/Users/almurat/KiKo/kiko-python/grok/router.py"
    with open(router_path, 'r') as f:
        content = f.read()
    
    # Check if GROK_SYSTEM_PROMPT is imported
    has_import = "from grok.prompts import GROK_SYSTEM_PROMPT" in content
    print(f"   {'❌' if has_import else '✅'} GROK_SYSTEM_PROMPT import: {'FOUND (BAD)' if has_import else 'NOT FOUND (GOOD)'}")
    
    # Check for the fixed code
    uses_node_prompt = 'chat.append(system(msg.content))' in content
    print(f"   {'✅' if uses_node_prompt else '❌'} Uses Node.js prompt: {uses_node_prompt}")
    
    # Check for the comment
    has_comment = "Use the system prompt from Node.js" in content
    print(f"   {'✅' if has_comment else '❌'} Has explanatory comment: {has_comment}")
    
    # Check if old override code is gone
    has_override = 'GROK_SYSTEM_PROMPT' in content and 'full_system_msg' in content
    print(f"   {'❌' if has_override else '✅'} Old override code removed: {not has_override}")
    
    return not has_import and uses_node_prompt and has_comment and not has_override

def check_node_orchestrator():
    """Check Node.js PromptOrchestrator for module assembly"""
    print("\n🔍 Checking Node.js PromptOrchestrator\n")
    
    orchestrator_path = "/Users/almurat/KiKo/kiko-api/src/services/ai/PromptOrchestrator.ts"
    with open(orchestrator_path, 'r') as f:
        content = f.read()
    
    # Check for key modules
    modules = {
        'IDENTITY': 'PROMPT_MODULES.IDENTITY',
        'MODEL_SAFETY': 'MODEL_SAFETY[model]',
        'TOOL_DIRECTIVE': 'PROMPT_MODULES.TOOL_DIRECTIVE',
        'KIKO_RULES': 'PROMPT_MODULES.KIKO_RULES',
        'EDGE_CASES': 'PROMPT_MODULES.EDGE_CASES',
        'MODEL_MODULES': 'MODEL_MODULES.grok',
        'INTENT_MODULES': 'INTENT_MODULES[intent]'
    }
    
    all_present = True
    for name, code in modules.items():
        present = code in content
        print(f"   {'✅' if present else '❌'} {name}: {present}")
        all_present = all_present and present
    
    return all_present

def check_grok_safety():
    """Check that GROK_SAFETY exists in models.ts"""
    print("\n🔍 Checking GROK_SAFETY in models.ts\n")
    
    models_path = "/Users/almurat/KiKo/kiko-api/src/services/ai/prompts/models.ts"
    with open(models_path, 'r') as f:
        content = f.read()
    
    checks = {
        'GROK_SAFETY export': 'export const GROK_SAFETY',
        'X Search filtering': 'X SEARCH FILTERING',
        'Three-Gate Check': 'Three-Gate Check',
        'Anti-jailbreak': 'ANTI-JAILBREAK'
    }
    
    all_present = True
    for name, text in checks.items():
        present = text in content
        print(f"   {'✅' if present else '❌'} {name}: {present}")
        all_present = all_present and present
    
    return all_present

def check_edge_cases():
    """Check that EDGE_CASES exists in core.ts"""
    print("\n🔍 Checking EDGE_CASES in core.ts\n")
    
    core_path = "/Users/almurat/KiKo/kiko-api/src/services/ai/prompts/core.ts"
    with open(core_path, 'r') as f:
        content = f.read()
    
    checks = {
        'EDGE_CASES export': 'export const EDGE_CASES',
        'FEW-SHOT examples': 'FEW-SHOT TOOL USAGE EXAMPLES',
        'Trading examples': 'Example 1: Simple Swap',
        'Wallet examples': 'Example 4: Check Balance'
    }
    
    all_present = True
    for name, text in checks.items():
        present = text in content
        print(f"   {'✅' if present else '❌'} {name}: {present}")
        all_present = all_present and present
    
    return all_present

def main():
    print("=" * 60)
    print("  Grok Prompt Integration Verification")
    print("=" * 60 + "\n")
    
    results = {
        'Python Router': check_python_router(),
        'Node Orchestrator': check_node_orchestrator(),
        'GROK_SAFETY': check_grok_safety(),
        'EDGE_CASES': check_edge_cases()
    }
    
    print("\n" + "=" * 60)
    print("  Summary")
    print("=" * 60 + "\n")
    
    all_pass = all(results.values())
    for component, passed in results.items():
        print(f"   {'✅' if passed else '❌'} {component}: {'PASS' if passed else 'FAIL'}")
    
    print("\n" + "=" * 60)
    if all_pass:
        print("  ✅ ALL CHECKS PASSED!")
        print("  Grok WILL receive complete Node.js prompts")
    else:
        print("  ❌ SOME CHECKS FAILED")
        print("  Review the failures above")
    print("=" * 60 + "\n")
    
    return 0 if all_pass else 1

if __name__ == "__main__":
    exit(main())
