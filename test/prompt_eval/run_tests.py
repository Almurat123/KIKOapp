import os
import json
import requests
import time
from datetime import datetime

# Configuration
API_URL = "http://localhost:8001/v1/chat/completions"  # Working grok-service endpoint
MODELS = ["grok-4-reasoning", "grok-4-non-reasoning"]
CASES_FILE = "test/prompt_eval/cases.json"
RESULTS_DIR = "test/prompt_eval/results"

def load_test_cases():
    with open(CASES_FILE, 'r') as f:
        return json.load(f)

def run_test(case, model):
    payload = {
        "model": model,
        "messages": [
            {"role": "user", "content": case["input"]}
        ],
        "temperature": 0.0,
        "stream": True # Use streaming to get full multi-turn behavior
    }
    
    headers = {
        "Content-Type": "application/json"
    }
    
    print(f"  Running case {case['id']} with model {model}...")
    try:
        start_time = time.time()
        response = requests.post(API_URL, json=payload, headers=headers, timeout=120, stream=True)
        end_time = time.time()
        
        full_content = ""
        tool_calls = []
        
        if response.status_code == 200:
            for line in response.iter_lines():
                if not line:
                    continue
                line = line.decode('utf-8')
                if line.startswith("data: "):
                    data_str = line[6:]
                    if data_str == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data_str)
                        delta = chunk.get("choices", [{}])[0].get("delta", {})
                        
                        # Accumulate content
                        if "content" in delta:
                            full_content += delta["content"]
                        
                        # Accumulate tool calls (from standardized OpenAI format)
                        if "tool_calls" in delta:
                            for tc in delta["tool_calls"]:
                                tool_calls.append(tc.get("function", {}).get("name", "unknown"))
                        
                        # Handle old simplified tool_call field if present
                        if "tool_call" in chunk:
                             tool_calls.append(chunk["tool_call"])
                             
                    except json.JSONDecodeError:
                        continue
            
            return {
                "id": case["id"],
                "status": "success",
                "content": full_content.strip(),
                "tool_calls": list(set(tool_calls)), # Deduplicate
                "latency": round(time.time() - start_time, 2)
            }
        else:
            return {
                "id": case["id"],
                "status": "error",
                "error": f"HTTP {response.status_code}: {response.text}"
            }
    except Exception as e:
        return {
            "id": case["id"],
            "status": "error",
            "error": str(e)
        }

def save_results(results, model):
    os.makedirs(RESULTS_DIR, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{RESULTS_DIR}/results_{model}_{timestamp}.json"
    with open(filename, 'w') as f:
        json.dump(results, f, indent=2)
    return filename

def generate_report(results_list):
    # This will be used later to generate a markdown comparison
    pass

if __name__ == "__main__":
    cases = load_test_cases()
    
    for model in MODELS:
        print(f"Starting tests for model: {model}")
        all_results = []
        for case in cases:
            res = run_test(case, model)
            all_results.append(res)
        
        saved_file = save_results(all_results, model)
        print(f"Finished. Results saved to {saved_file}\n")
