export interface VatInclusiveBreakdown {
  gross: number;
  net: number;
  vat: number;
  rate: number;
}

export function calculateVatInclusiveBreakdown(gross: number, vatRatePercent: number): VatInclusiveBreakdown {
  const numericGross = Number.isFinite(gross) ? Number(gross) : 0;
  const safeRatePercent = Number.isFinite(vatRatePercent) ? Number(vatRatePercent) : 0;
  const normalizedRate = Math.max(0, safeRatePercent) / 100;

  if (numericGross <= 0 || normalizedRate <= 0) {
    return {
      gross: Number(numericGross.toFixed(2)),
      net: Number(numericGross.toFixed(2)),
      vat: 0,
      rate: normalizedRate
    };
  }

  const net = numericGross / (1 + normalizedRate);
  const vat = numericGross - net;

  return {
    gross: Number(numericGross.toFixed(2)),
    net: Number(net.toFixed(2)),
    vat: Number(vat.toFixed(2)),
    rate: normalizedRate
  };
}
