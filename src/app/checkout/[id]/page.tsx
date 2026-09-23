"use client";

import { useState, useEffect, Suspense } from "react";
import Script from "next/script";
import { useParams, useSearchParams } from "next/navigation";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/Button";
import { formatRupees, isValidPaise } from "@/shared/utils/money";

interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayErrorResponse {
  error: {
    description: string;
    code: string;
    source: string;
    step: string;
    reason: string;
    metadata: {
      order_id: string;
      payment_id: string;
    };
  };
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: (res: unknown) => void) => void;
    };
  }
}

function CheckoutContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const commissionId = params.id as string;
  const token = searchParams.get("token") || "";

  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [failReason, setFailReason] = useState("");
  const [pricePaise, setPricePaise] = useState<number | null>(null);
  const [collectorName, setCollectorName] = useState<string>("");
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [timeLeftStr, setTimeLeftStr] = useState<string>("");
  const [isGatewayReady, setIsGatewayReady] = useState(false);
  const [isValidating, setIsValidating] = useState(true);

  // Authoritative server-side token and status validation
  useEffect(() => {
    let isMounted = true;
    if (!commissionId) return;

    async function validateCheckout() {
      try {
        const res = await fetch("/api/checkout/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ commissionId, token: token || undefined }),
        });

        const data = await res.json();
        if (!isMounted) return;

        if (!res.ok || !data.success) {
          if (res.status === 410) {
            setFailReason("This exclusive 24-hour acquisition window has permanently expired.");
          } else if (res.status === 403) {
            setFailReason("Private clearance required. The security token in this link is invalid or missing.");
          } else {
            setFailReason(data.message || "This acquisition link could not be validated.");
          }
          return;
        }

        const comm = data.data;
        if (comm.status === "paid" || comm.status === "fulfilled") {
          setIsSuccess(true);
          return;
        }

        if (isValidPaise(comm.price) && comm.price > 0) {
          setPricePaise(comm.price);
        } else {
          setFailReason("The curator has not assigned a pricing valuation to this piece yet.");
        }

        setCollectorName(comm.name);
        setExpiresAt(comm.expires_at);
      } catch (err) {
        console.error("[CHECKOUT_VALIDATION_ERROR]", err);
        if (isMounted) setFailReason("Could not verify acquisition status. Please refresh.");
      } finally {
        if (isMounted) setIsValidating(false);
      }
    }

    validateCheckout();

    return () => {
      isMounted = false;
    };
  }, [commissionId, token]);

  // Server-authoritative countdown timer
  useEffect(() => {
    if (!expiresAt) return;

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const expiry = new Date(expiresAt).getTime();
      const diff = expiry - now;

      if (diff <= 0) {
        setTimeLeftStr("EXPIRED");
        setFailReason("This exclusive 24-hour acquisition window has permanently expired.");
        clearInterval(interval);
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeftStr(`${hours}h ${minutes}m ${seconds}s`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  const handlePayment = async () => {
    setIsProcessing(true);
    setFailReason("");

    try {
      // 1. Authoritative Server Order Generation with Token
      const res = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commissionId, token: token || undefined }),
      });

      const resData = await res.json();

      if (!res.ok || !resData.success) {
        if (res.status === 410) {
          setFailReason("This exclusive acquisition window has permanently expired (24-hour limit).");
        } else if (res.status === 403) {
          setFailReason("Private clearance token invalid or unauthorized.");
        } else {
          setFailReason(resData.message || "Failed to initialize secure checkout. Please try again.");
        }
        setIsProcessing(false);
        return;
      }

      const { orderId, amount } = resData;

      // 2. Gateway Availability Verification
      if (!window.Razorpay) {
        setFailReason(
          "Payment gateway failed to load. Please ensure content blockers or adblockers are disabled, and refresh."
        );
        setIsProcessing(false);
        return;
      }

      const publishableKey = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
      if (!publishableKey) {
        setFailReason("Payment system configuration error. Please contact the studio.");
        setIsProcessing(false);
        return;
      }

      // 3. Initialize Razorpay Checkout Instance
      const options = {
        key: publishableKey,
        amount: amount, // In exact integer paise
        currency: "INR",
        name: "Artfolio Fine Arts",
        description: `Bespoke Artwork Commission Acquisition for ${collectorName || "Collector"}`,
        order_id: orderId,
        theme: { color: "#0D0D0D" },
        handler: async function (response: RazorpayResponse) {
          try {
            setIsProcessing(true);

            // 4. Server-Side Verification: Frontend state NEVER marks payment as paid
            const verifyRes = await fetch("/api/payment/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                commissionId,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });

            const verifyData = await verifyRes.json();
            if (verifyRes.ok && verifyData.success) {
              setIsSuccess(true);
            } else {
              setFailReason(verifyData.message || "Payment verification failed. Please contact studio support.");
            }
          } catch (verifyErr) {
            console.error("[VERIFY_CLIENT_FATAL]", verifyErr);
            setFailReason(
              "Network error during payment verification. If funds were debited, your order will be confirmed automatically via email."
            );
          } finally {
            setIsProcessing(false);
          }
        },
      };

      const razorpayInstance = new window.Razorpay(options);

      razorpayInstance.on("payment.failed", function (res: unknown) {
        const response = res as RazorpayErrorResponse;
        setFailReason(
          `Transaction Declined: ${response.error?.description || "Payment failed"}. Please retry with an alternate card or UPI.`
        );
        setIsProcessing(false);
      });

      razorpayInstance.on("payment.modal.closed", function () {
        setIsProcessing(false);
      });

      razorpayInstance.open();
    } catch (e) {
      console.error("[PAYMENT_TRIGGER_ERROR]", e);
      setFailReason("Checkout initialization failed securely. Please try again.");
      setIsProcessing(false);
    }
  };

  // Luxury Success Block
  if (isSuccess) {
    return (
      <div className="flex-1 flex flex-col bg-background min-h-[70vh]">
        <Section className="flex-1 flex items-center justify-center">
          <div className="text-center animate-in fade-in duration-1000 max-w-md p-8 border border-primary/30 bg-surface-highest/5">
            <span className="text-[10px] uppercase tracking-[0.3em] text-primary font-sans block mb-2">
              Verified Acquisition
            </span>
            <h1 className="font-serif text-3xl md:text-4xl text-text mb-4 font-normal">
              Commission Secured
            </h1>
            <p className="font-sans text-muted tracking-wide text-xs leading-relaxed">
              Your bespoke acquisition has been verified and recorded on the private ledger. Krishna Kumar has been notified and creation will commence.
            </p>
          </div>
        </Section>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-background min-h-[70vh]">
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        onLoad={() => setIsGatewayReady(true)}
        onError={() => {
          setIsGatewayReady(false);
          setFailReason("Failed to load secure payment gateway. Please check your connection.");
        }}
      />

      <Section className="flex-1 flex flex-col justify-center max-w-lg mx-auto w-full py-24 animate-in fade-in duration-700">
        <div className="border border-outline-variant/30 p-8 md:p-12 bg-surface-highest/10 backdrop-blur-md flex flex-col items-center text-center shadow-2xl">
          <span className="text-[10px] uppercase tracking-[0.25em] text-primary mb-4 font-sans">
            Private Curatorial Allocation
          </span>

          <h1 className="font-serif text-3xl md:text-4xl text-text leading-[1.1] mb-2 font-normal">
            Bespoke Commission
          </h1>
          <p className="font-sans text-muted text-xs italic mb-8">
            {collectorName ? `Reserved for ${collectorName}` : "Reserved studio creation slot."}
          </p>

          {/* Expiration Countdown */}
          {timeLeftStr && timeLeftStr !== "EXPIRED" && (
            <div className="mb-8 px-4 py-2 border border-primary/30 bg-primary/5 text-primary text-[11px] font-mono tracking-wider">
              Acquisition Window: <span className="font-semibold text-text">{timeLeftStr}</span>
            </div>
          )}

          <div className="w-full h-[1px] bg-outline-variant/20 mb-8" />

          <div className="flex flex-col gap-3 w-full mb-8 font-sans">
            <div className="flex justify-between items-center w-full text-xs text-muted uppercase tracking-widest">
              <span>Studio Honorarium</span>
              <span className="font-mono text-text">
                {pricePaise !== null ? formatRupees(pricePaise) : "---"}
              </span>
            </div>
            <div className="flex justify-between items-center w-full text-xs text-primary uppercase tracking-[0.2em]">
              <span>Total Capital (INR)</span>
              <span className="font-mono font-semibold text-sm">
                {pricePaise !== null ? formatRupees(pricePaise) : "---"}
              </span>
            </div>
          </div>

          <Button
            onClick={handlePayment}
            disabled={isProcessing || pricePaise === null || !isGatewayReady || isValidating || timeLeftStr === "EXPIRED"}
            className="w-full text-center py-4 bg-primary text-black hover:bg-white transition-all uppercase tracking-widest text-[11px] font-semibold h-auto disabled:opacity-40"
          >
            {isProcessing
              ? "Connecting to Security Gateway..."
              : isValidating
              ? "Verifying Token Clearance..."
              : !isGatewayReady
              ? "Initializing Gateway..."
              : timeLeftStr === "EXPIRED"
              ? "Acquisition Expired"
              : "Secure Allocation &rarr;"}
          </Button>

          {failReason && (
            <div
              role="alert"
              className="mt-6 p-4 border border-red-500/40 bg-red-950/20 text-red-400 text-xs font-sans tracking-wide text-center w-full"
            >
              {failReason}
            </div>
          )}

          <p className="text-[10px] text-muted/50 mt-6 tracking-wide text-center uppercase font-sans">
            Protected via 256-bit SSL Cryptography &bull; Razorpay Private Gateway
          </p>
        </div>
      </Section>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[70vh] flex items-center justify-center font-sans text-xs uppercase tracking-widest text-muted">
          Loading Secure Checkout...
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
