export function generatePixQr(data: {
  pixKey: string;
  merchantName: string;
  merchantCity: string;
  amount: number;
  transactionId: string;
}): Promise<{
  copyPasteCode: string;
  qrCode: Buffer;
}>;