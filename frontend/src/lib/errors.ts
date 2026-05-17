import { BaseError } from "viem";

/**
 * Pull the most useful human-readable string out of a wagmi/viem error.
 * Viem wraps errors in a cause chain (TransactionExecutionError → ContractFunctionExecutionError → ContractFunctionRevertedError),
 * and `shortMessage` walks the chain for us.
 */
export function formatTxError(err: unknown): string {
  if (!err) return "";
  if (err instanceof BaseError) {
    return err.shortMessage || err.message;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}
