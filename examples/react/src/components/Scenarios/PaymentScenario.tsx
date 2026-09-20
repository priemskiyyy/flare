import { useFlare } from "@priemskiyyy/flare-react";

import type { ExampleReport } from "src/types/ExampleReport";

export const PaymentScenario = ({
  onReport,
}: {
  onReport: (report: ExampleReport) => void;
}) => {
  const flare = useFlare();
  const handlePayment = () => {
    onReport({
      title: "Payment declined",
      receipt: flare.capture(new Error("The payment was declined"), {
        tags: { area: "checkout" },
        contexts: { payment: { cardToken: "tok_live_123", amount: 42 } },
      }),
    });
  };

  return (
    <section className="scenario" aria-labelledby="payment-heading">
      <div className="scenario-heading">
        <span className="scenario-symbol" aria-hidden="true">
          $
        </span>
        <div>
          <h2 id="payment-heading">Checkout failure</h2>
          <p>Capture an error. Keep the useful context.</p>
        </div>
        <span className="feature-tag">Redaction</span>
      </div>
      <div className="payment-preview">
        <span>
          Order total<strong>$42.00</strong>
        </span>
        <span>
          Card token<code>tok_live_123</code>
        </span>
      </div>
      <div className="scenario-footer">
        <button
          className="primary-button"
          type="button"
          onClick={handlePayment}
        >
          Report payment failure
        </button>
        <span>The token is redacted before sending.</span>
      </div>
    </section>
  );
};
