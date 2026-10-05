const mercadoPagoEndpoint = "https://api.mercadopago.com/v1/payments";
const amploPayEndpoint = "https://app.amplopay.com/api/v1/gateway/pix/receive";

async function readJsonResponse(response, provider) {
  const responseText = await response.text();
  let data;

  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(`${provider} retornou uma resposta inválida (HTTP ${response.status}).`);
  }

  if (!response.ok || (Number(data.statusCode) >= 400)) {
    const status = data.statusCode || response.status;
    const detail = data.message || data.error || "Confira as credenciais da integração.";
    throw new Error(`${provider} respondeu HTTP ${status}: ${detail}`);
  }

  return data;
}

async function createMercadoPagoPix({
  accessToken,
  orderId,
  amount,
  description,
  notificationUrl,
  payerEmail,
  payerName,
  applicationFeeCents,
  fetchImpl = fetch,
}) {
  const requestBody = {
    transaction_amount: Number(amount.toFixed(2)),
    description,
    payment_method_id: "pix",
    notification_url: notificationUrl,
    payer: {
      email: payerEmail,
      first_name: payerName,
    },
    ...(Number.isInteger(applicationFeeCents) && applicationFeeCents > 0
      ? { application_fee: applicationFeeCents / 100 }
      : {}),
  };
  const response = await fetchImpl(mercadoPagoEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "X-Idempotency-Key": orderId,
    },
    body: JSON.stringify(requestBody),
  });

  const data = await readJsonResponse(response, "Mercado Pago");
  const transaction = data.point_of_interaction?.transaction_data;

  if (!data.id || !transaction?.qr_code) {
    throw new Error("Mercado Pago não retornou o código Pix para esta cobrança.");
  }

  return {
    paymentId: String(data.id),
    pixCode: transaction.qr_code,
    qrCodeBase64: transaction.qr_code_base64 || null,
    ticketUrl: transaction.ticket_url || null,
    applicationFeeCents: Number.isInteger(applicationFeeCents) && applicationFeeCents > 0 ? applicationFeeCents : null,
  };
}

async function createAmploPayPix({
  clientId,
  clientSecret,
  payload,
  fetchImpl = fetch,
}) {
  const response = await fetchImpl(amploPayEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "x-public-key": clientId,
      "x-secret-key": clientSecret,
    },
    body: JSON.stringify(payload),
  });

  const data = await readJsonResponse(response, "AmploPay");
  const pixCode = data.pix?.code;

  if (!pixCode) {
    throw new Error("AmploPay não retornou o código Pix esperado.");
  }

  return {
    paymentId: data.transactionId ? String(data.transactionId) : null,
    pixCode,
  };
}

module.exports = { createMercadoPagoPix, createAmploPayPix };