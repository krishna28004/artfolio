/** Explicit operator switches. Default closed in every environment. */
export const isCommissionIntakeEnabled = () => process.env.ARTFOLIO_COMMISSIONS_ENABLED === "true";
export const isPaymentCheckoutEnabled = () => process.env.ARTFOLIO_PAYMENTS_ENABLED === "true";
