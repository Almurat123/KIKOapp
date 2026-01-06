
import json
import requests

def test_citations():
    url = "http://localhost:8000/grok/v1/chat/completions"
    payload = {
        "model": "grok-beta",
        "messages": [
            {"role": "user", "content": "When is the next SpaceX Starship test flight (Flight 7)? Please search the web to find the latest official information or estimates from SpaceX or Elon Musk."}
        ],
        "stream": True,
        "enable_search": True
    }
    
    print(f"Testing citations from {url}...")
    try:
        response = requests.post(url, json=payload, stream=True, headers={"Authorization": "Bearer dev"})
        response.raise_for_status()
        
        found_citations = False
        for line in response.iter_lines():
            if line:
                line_str = line.decode('utf-8')
                if line_str.startswith("data: "):
                    data_str = line_str[6:]
                    if data_str == "[DONE]":
                        continue
                    try:
                        data = json.loads(data_str)
                        # Check choices[0].message.citations or choices[0].delta.citations
                        choice = data.get('choices', [{}])[0]
                        delta = choice.get('delta', {})
                        message = choice.get('message', {})
                        
                        # Print keys for debugging
                        if data.get('usage'):
                            print("\n[Usage info received]")
                        
                        citations = message.get('citations') or delta.get('citations')
                        if citations:
                            print(f"\n✅ Found citations: {json.dumps(citations, indent=2)}")
                            found_citations = True
                        
                        if delta.get('content'):
                            print(delta.get('content'), end="", flush=True)
                    except json.JSONDecodeError:
                        continue
        
        if not found_citations:
            print("\n❌ No citations found in the stream.")
            
    except Exception as e:
        print(f"\n❌ Error: {e}")

if __name__ == "__main__":
    test_citations()
