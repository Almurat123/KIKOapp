import assert from 'node:assert/strict';
import test from 'node:test';

import { validateAddress } from './validation.js';

test('validateAddress rejects truncated EVM addresses and accepts strict wallet addresses', () => {
    assert.equal(validateAddress('0xbd708164137146ac234aceb75d3981cd3599e21a'), true);
    assert.equal(validateAddress('0xbd708164137146ac234aceb75d3981cd359e21a'), false);
    assert.equal(validateAddress('0x077b9981bc8a2ca417cea41861111da63266988b'), true);
    assert.equal(validateAddress('0x077b9981bc8a2ca417cea418611da63266988b'), false);
});
