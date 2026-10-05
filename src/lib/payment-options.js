const SUPPORTED_PAYMENT_METHODS = [
  "mercadopago",
  "amplopay",
  "pix_direto",
  "syncpay",
];

const BILLING_TYPES = [
  "one_time",
  "recurring",
];

const RECURRING_INTERVALS = [
  "monthly",
  "quarterly",
  "yearly",
];

function isValidPaymentMethod(method) {
  return typeof method === "string" && SUPPORTED_PAYMENT_METHODS.includes(method);
}

function normalizeBillingType(value) {
  if (value === "recurring") return "recurring";
  return "one_time";
}

function normalizeRecurringInterval(value) {
  if (typeof value === "string" && RECURRING_INTERVALS.includes(value)) {
    return value;
  }
  return "monthly";
}

module.exports = {
  SUPPORTED_PAYMENT_METHODS,
  BILLING_TYPES,
  RECURRING_INTERVALS,
  isValidPaymentMethod,
  normalizeBillingType,
  normalizeRecurringInterval,
};
