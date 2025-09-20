export type GSTCalculationInput = {
  taxableAmount: number;
  gstApplicable: boolean;
  gstType: 'IGST' | 'CGST_SGST' | null;
  gstRate: number | null;
};

export type GSTCalculationOutput = {
  cgst: number;
  sgst: number;
  igst: number;
  totalGST: number;
  grandTotal: number;
};

export function calculateGST(input: GSTCalculationInput): GSTCalculationOutput {
  const { taxableAmount, gstApplicable, gstType, gstRate } = input;

  if (!gstApplicable || !gstType || !gstRate || gstRate <= 0) {
    return {
      cgst: 0,
      sgst: 0,
      igst: 0,
      totalGST: 0,
      grandTotal: taxableAmount,
    } as GSTCalculationOutput;
  }

  const rate = Number(gstRate);
  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  if (gstType === 'IGST') {
    igst = (taxableAmount * rate) / 100;
  } else if (gstType === 'CGST_SGST') {
    const half = rate / 2;
    cgst = (taxableAmount * half) / 100;
    sgst = (taxableAmount * half) / 100;
  }

  const totalGST = cgst + sgst + igst;
  const grandTotal = taxableAmount + totalGST;
  return { cgst, sgst, igst, totalGST, grandTotal };
}
