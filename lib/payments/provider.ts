export type PaymentStatus = "pending" | "paid" | "failed" | "cancelled" | "refunded";

export interface PaymentProvider {
  name: string;
  createCheckout(input: { externalReference: string; amount: number; currency: string; description: string; payerEmail?: string | null }): Promise<{ providerPaymentId: string; paymentUrl: string }>;
  verifyWebhookSignature(input: { headers: Headers; dataId: string }): boolean;
  fetchPaymentStatus(providerPaymentId: string): Promise<{ status: PaymentStatus; paidAt: string | null; amount: number; currency: string; externalReference: string | null }>;
}
