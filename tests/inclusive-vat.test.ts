import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateVatInclusiveBreakdown } from '../src/lib/pricing.ts';

test('inclusive VAT breakdown keeps the displayed total at the price paid while deriving the VAT portion', () => {
  const result = calculateVatInclusiveBreakdown(100, 20);

  assert.equal(result.gross, 100);
  assert.equal(result.net, 83.33);
  assert.equal(result.vat, 16.67);
});
