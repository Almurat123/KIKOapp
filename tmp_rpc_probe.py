import requests, time

endpoints = [
    ('PublicNode', 'https://solana-rpc.publicnode.com'),
    ('Ankr', 'https://rpc.ankr.com/solana'),
    ('SolanaOfficial', 'https://api.mainnet-beta.solana.com'),
    ('DRPC', 'https://solana.drpc.org'),
]
methods = ['getSlot', 'getLatestBlockhash', 'getRecentPrioritizationFees']

for name, url in endpoints:
    print(f"\n{name} {url}")
    for method in methods:
        ok = 0
        errs = []
        timings = []
        for i in range(6):
            params = []
            if method == 'getLatestBlockhash':
                params = [{'commitment': 'confirmed'}]
            body = {'jsonrpc': '2.0', 'id': i, 'method': method, 'params': params}
            started = time.time()
            try:
                resp = requests.post(url, json=body, timeout=3)
                elapsed = (time.time() - started) * 1000
                payload = resp.text
                if resp.status_code == 200 and '"error"' not in payload:
                    ok += 1
                    timings.append(elapsed)
                else:
                    errs.append(f"{resp.status_code}:{payload[:90]}")
            except Exception as ex:
                errs.append(str(ex)[:90])
        avg = round(sum(timings) / len(timings), 1) if timings else None
        print(f"  {method:<28} ok={ok}/6 avg_ms={avg} sample_err={errs[:1]}")
