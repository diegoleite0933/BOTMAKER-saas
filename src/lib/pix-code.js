function normalizeField(value, maxLength, fallback) {
  const normalized = String(value || fallback)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
    .slice(0, maxLength);

  return normalized || fallback;
}

async function generatePixQr({ pixKey, merchantName, merchantCity, amount, transactionId }) {
  if (!pixKey || !Number.isFinite(amount) || amount <= 0) {
    throw new Error("Dados inválidos para gerar o Pix.");
  }

  const { payload } = await import("pix-payload");
  const qrCodeModule = await import("qrcode");
  const QRCode = qrCodeModule.default || qrCodeModule;

  const copyPasteCode = payload({
    key: pixKey.trim(),
    name: normalizeField(merchantName, 25, "ODISSEIABOT"),
    city: normalizeField(merchantCity, 15, "SAO PAULO"),
    amount: Number(amount.toFixed(2)),
    transactionId: normalizeField(transactionId, 25, "PEDIDO"),
  });
  const qrCode = await QRCode.toBuffer(copyPasteCode, {
    errorCorrectionLevel: "M",
    margin: 1,
    type: "png",
    width: 600,
  });

  return { copyPasteCode, qrCode };
}

module.exports = { generatePixQr };