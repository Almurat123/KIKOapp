import 'dotenv/config';

const token = process.env.ALCHEMY_AUTH_TOKEN;
const webhookId = process.env.ALCHEMY_WEBHOOK_ID_SOL;

if (!token || !webhookId) {
  throw new Error('Missing ALCHEMY_AUTH_TOKEN or ALCHEMY_WEBHOOK_ID_SOL');
}

const wrong = 'CWk2NqZwy3Fo9cumJcWwt45j4D6FnboS5h3vHZWtKyvT';
const right = 'CWk2NqZwy3Fo9cumJcWwt45j4D6FnboS5h3vHZWtKyvV';

const body = {
  webhook_id: webhookId,
  addresses_to_add: [right.toLowerCase()],
  addresses_to_remove: [wrong, wrong.toLowerCase()],
};

const upd = await fetch('https://dashboard.alchemy.com/api/update-webhook-addresses', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'X-Alchemy-Token': token,
  },
  body: JSON.stringify(body),
});
const updText = await upd.text();

const list = await fetch(`https://dashboard.alchemy.com/api/webhook-addresses?webhook_id=${encodeURIComponent(webhookId)}`, {
  headers: { 'X-Alchemy-Token': token },
});
const listJson = await list.json();
const arr = Array.isArray(listJson?.data) ? listJson.data : [];

const hasRight = arr.includes(right.toLowerCase()) || arr.includes(right);
const hasWrong = arr.includes(wrong.toLowerCase()) || arr.includes(wrong);

console.log(JSON.stringify({
  updateStatus: upd.status,
  updateBodyPreview: updText.slice(0, 300),
  listStatus: list.status,
  addressesCount: arr.length,
  hasRight,
  hasWrong,
}, null, 2));
