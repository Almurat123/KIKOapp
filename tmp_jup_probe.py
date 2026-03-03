import requests, time

pairs = [
    ('So11111111111111111111111111111111111111112', 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', '1000000'),
    ('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 'So11111111111111111111111111111111111111112', '1000000'),
]
bases = [
    'https://lite-api.jup.ag/swap/v1',
    'https://api.jup.ag/swap/v1',
]
for base in bases:
    print(f"\nBASE {base}")
    ok=0; fail=0; times=[]; errs=[]
    for i in range(8):
        inp,out,amt = pairs[i % len(pairs)]
        url = f"{base}/quote?inputMint={inp}&outputMint={out}&amount={amt}&slippageBps=1000"
        t=time.time()
        try:
            r=requests.get(url, timeout=5)
            dt=(time.time()-t)*1000
            if r.status_code==200 and 'error' not in r.text.lower():
                ok += 1
                times.append(dt)
            else:
                fail += 1
                errs.append(f"{r.status_code}:{r.text[:120]}")
        except Exception as ex:
            fail += 1
            errs.append(str(ex)[:120])
    avg = round(sum(times)/len(times),1) if times else None
    p95 = round(sorted(times)[int(len(times)*0.95)-1],1) if times else None
    print(f"  quote ok={ok}/8 fail={fail}/8 avg_ms={avg} p95_ms={p95} sample_err={errs[:1]}")
