import type { PaymentCredentials, PaymentProvider } from "@/lib/payment-credentials";

export function createPixPayment(request: {
  provider: PaymentProvider;
  credentials: PaymentCredentials;
  orderId: string;
  amount: number;
  description: string;
  notificationUrl: string;
  payerEmail: string;
  payerName: string;
  merchantName: string;
  merchantCity: string;
  amploPayload: Record<string, unknown>;
  fetchImpl?: typeof fetch;
}): Promise<{
  provider: PaymentProvider;
  paymentId: string | null;
  pixCode: string;
  qrCodeBase64?: string | null;
  ticketUrl?: string | null;
  qrCode?: Buffer;
}>;

export function createPaymentWebhookSignature(orderId: string): string;
export function verifyPaymentWebhookSignature(orderId: string, signature: string | null): boolean;