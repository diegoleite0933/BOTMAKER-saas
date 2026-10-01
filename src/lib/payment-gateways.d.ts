type PixGatewayFetch = typeof fetch;

export function createMercadoPagoPix(data: {
  accessToken: string;
  orderId: string;
  amount: number;
  description: string;
  notificationUrl: string;
  payerEmail: string;
  payerName: string;
  fetchImpl?: PixGatewayFetch;
}): Promise<{
  paymentId: string;
  pixCode: string;
  qrCodeBase64: string | null;
  ticketUrl: string | null;
}>;

export function createAmploPayPix(data: {
  clientId: string;
  clientSecret: string;
  payload: Record<string, unknown>;
  fetchImpl?: PixGatewayFetch;
}): Promise<{
  paymentId: string | null;
  pixCode: string;
}>;