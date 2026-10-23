export type LenzpayProvider = "MTN" | "AIRTEL";

export type LenzpayTransaction = {
  transactionId: string;
  orderId: string;
  status: "PENDING" | "SUCCESSFUL" | "FAILED";
  amount: string;
  provider: LenzpayProvider;
};

export type LenzpayCheckoutInput = {
  amount: number;
  payerPhone: string;
  provider: LenzpayProvider;
  orderId: string;
};

export class LenzpayRequestError extends Error {
  constructor(
    message: string,
    readonly definitive: boolean,
    readonly transaction: LenzpayTransaction | null = null,
  ) {
    super(message);
    this.name = "LenzpayRequestError";
  }
}

function getConfig(): { baseUrl: string; clientId: string; clientSecret: string } | null {
  const baseUrl = (process.env["LENZPAY_API_BASE_URL"] ?? "").trim().replace(/\/+$/, "");
  const clientId = (process.env["LENZPAY_CLIENT_ID"] ?? "").trim();
  const clientSecret = (process.env["LENZPAY_CLIENT_SECRET"] ?? "").trim();
  if (!baseUrl || !clientId || !clientSecret) return null;

  try {
    const parsed = new URL(baseUrl);
    const localHttp = parsed.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsed.hostname);
    if (parsed.protocol !== "https:" && !localHttp) return null;
  } catch {
    return null;
  }

  return { baseUrl, clientId, clientSecret };
}

export function isLenzpayConfigured(): boolean {
  return getConfig() !== null;
}

function normalizeStatus(value: unknown): LenzpayTransaction["status"] | null {
  if (typeof value !== "string") return null;
  const status = value.toUpperCase();
  return status === "PENDING" || status === "SUCCESSFUL" || status === "FAILED" ? status : null;
}

function parseTransaction(value: unknown): LenzpayTransaction | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  const status = normalizeStatus(data["status"]);
  const provider = data["provider"];
  if (
    typeof data["transactionId"] !== "string" ||
    typeof data["orderId"] !== "string" ||
    typeof data["amount"] !== "string" ||
    !status ||
    (provider !== "MTN" && provider !== "AIRTEL")
  ) return null;
  return {
    transactionId: data["transactionId"],
    orderId: data["orderId"],
    status,
    amount: data["amount"],
    provider,
  };
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function headers(config: { clientId: string; clientSecret: string }): HeadersInit {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-Client-ID": config.clientId,
    "X-Client-Secret": config.clientSecret,
  };
}

export async function initiateLenzpayPayment(input: LenzpayCheckoutInput): Promise<LenzpayTransaction> {
  const config = getConfig();
  if (!config) {
    throw new LenzpayRequestError("Lenzpay is not configured on the server.", true);
  }

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/api/v1/payments/checkout`, {
      method: "POST",
      headers: headers(config),
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new LenzpayRequestError("Lenzpay could not be reached; payment state is not yet known.", false);
  }

  const data = await readJson(response);
  const transaction = parseTransaction(data);
  if (!response.ok) {
    const failed = transaction?.status === "FAILED";
    const errorData = data && typeof data === "object" ? (data as Record<string, unknown>)["error"] : null;
    const errorCode = errorData && typeof errorData === "object"
      ? (errorData as Record<string, unknown>)["code"]
      : null;
    const definitiveHttpError = response.status >= 400 && response.status < 500 &&
      response.status !== 408 && response.status !== 409;
    const definitiveProviderSetupError = response.status === 503 && errorCode === "PROVIDER_NOT_CONFIGURED";
    throw new LenzpayRequestError(
      failed ? "Lenzpay declined the payment request." : "Lenzpay could not confirm the payment request.",
      failed || definitiveHttpError || definitiveProviderSetupError,
      transaction,
    );
  }
  if (
    !transaction ||
    transaction.orderId !== input.orderId ||
    transaction.provider !== input.provider ||
    Number(transaction.amount) !== input.amount
  ) {
    throw new LenzpayRequestError("Lenzpay returned an incomplete or mismatched payment response.", false);
  }
  return transaction;
}

export async function getLenzpayPayment(transactionId: string): Promise<LenzpayTransaction> {
  const config = getConfig();
  if (!config) {
    throw new LenzpayRequestError("Lenzpay is not configured on the server.", false);
  }

  let response: Response;
  try {
    response = await fetch(
      `${config.baseUrl}/api/v1/payments/${encodeURIComponent(transactionId)}`,
      { headers: headers(config), signal: AbortSignal.timeout(10_000) },
    );
  } catch {
    throw new LenzpayRequestError("Lenzpay status is temporarily unavailable.", false);
  }

  const transaction = parseTransaction(await readJson(response));
  if (!response.ok || !transaction || transaction.transactionId !== transactionId) {
    throw new LenzpayRequestError("Lenzpay status is temporarily unavailable.", false);
  }
  return transaction;
}
