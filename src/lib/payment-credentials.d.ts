export type PaymentProvider = "mercadopago" | "amplopay" | "pix_direto";
export type PaymentCredentials = Record<string, string>;

export function encryptPaymentCredentials(credentials: PaymentCredentials): string;
export function decryptPaymentCredentials(payload: string): PaymentCredentials;
export function resolvePaymentCredentials(
  prisma: unknown,
  bot: Record<string, unknown> & { workspaceId: string },
  provider: PaymentProvider,
): Promise<PaymentCredentials>;