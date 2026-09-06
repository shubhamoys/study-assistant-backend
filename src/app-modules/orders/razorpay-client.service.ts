import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Razorpay from 'razorpay';
import type { Orders } from 'razorpay/dist/types/orders';
import type { Payments } from 'razorpay/dist/types/payments';
import { validatePaymentVerification } from 'razorpay/dist/utils/razorpay-utils';

/**
 * Isolates every call this app makes to Razorpay's API/crypto behind one
 * injectable class. `createOrder`/`fetchPayment` are real network calls —
 * e2e tests override this whole class (`overrideProvider(RazorpayClient)`)
 * rather than hitting Razorpay's live API or needing a browser-driven
 * payment for every test run. `verifySignature` is *not* a network call
 * (pure HMAC using the account's key secret) — it stays real even when this
 * class is otherwise overridden, since it's the actual security-critical
 * logic a test needs to exercise for real.
 */
@Injectable()
export class RazorpayClient {
  private readonly client: Razorpay;
  private readonly keySecret: string;

  constructor(configService: ConfigService) {
    const keyId = configService.get<string>('razorpay.keyId');
    const keySecret = configService.get<string>('razorpay.keySecret');
    this.keySecret = keySecret ?? '';
    this.client = new Razorpay({ key_id: keyId, key_secret: keySecret });
  }

  createOrder(params: {
    amount: number;
    currency: string;
    receipt: string;
  }): Promise<Orders.RazorpayOrder> {
    return this.client.orders.create(params);
  }

  fetchPayment(paymentId: string): Promise<Payments.RazorpayPayment> {
    return this.client.payments.fetch(paymentId);
  }

  /**
   * Official Razorpay HMAC-SHA256 check (`order_id|payment_id`, keyed with
   * the account's secret) — only Razorpay and this server can produce a
   * signature that matches a given (order, payment) pair, since the secret
   * never reaches the frontend. This is what makes payment completion
   * unforgeable by a client.
   */
  verifySignature(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    signature: string,
  ): boolean {
    return validatePaymentVerification(
      { order_id: razorpayOrderId, payment_id: razorpayPaymentId },
      signature,
      this.keySecret,
    );
  }
}
