const ALCHEMY_API_KEY = "Cmrwi0FonoT_sPwZhJXou"; // from env
const address = "0x77777351928ce19bee8ff5b4b1406bc4c152827a";

async function check() {
    const res = await fetch(`https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "alchemy_getAssetTransfers",
            params: [
                {
                    fromBlock: "0x0",
                    toBlock: "latest",
                    fromAddress: address,
                    category: ["external", "erc20"],
                    order: "desc",
                    maxCount: "0x5"
                }
            ]
        })
    });
    const data = await res.json();
    console.log("Sent transfers:", JSON.stringify(data.result.transfers));

    const res2 = await fetch(`https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "alchemy_getAssetTransfers",
            params: [
                {
                    fromBlock: "0x0",
                    toBlock: "latest",
                    toAddress: address,
                    category: ["external", "erc20"],
                    order: "desc",
                    maxCount: "0x5"
                }
            ]
        })
    });
    const data2 = await res2.json();
    console.log("Received transfers:", JSON.stringify(data2.result.transfers));
}

check();
