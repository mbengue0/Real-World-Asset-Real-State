import { useEffect, useState } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatEther } from "viem";
import { propertyFactoryAbi } from "../abi/PropertyFactory";
import { paymentTokenAbi } from "../abi/PaymentToken";
import { CONFIG } from "../config";
import type { OnChainProperty } from "../hooks/useProperties";
import { formatTxError } from "../lib/errors";

interface Props {
  property: OnChainProperty;
  onSuccess?: () => void;
}

/**
 * Two-step purchase: (1) approve PaymentToken for the factory,
 * (2) call buyShares. The button rotates between the two states
 * based on the live allowance read.
 */
export function BuyForm({ property, onSuccess }: Props) {
  const { address, isConnected } = useAccount();
  const [shareCount, setShareCount] = useState("1");

  const sharesBn = (() => {
    try {
      return BigInt(shareCount || "0");
    } catch {
      return 0n;
    }
  })();
  const totalCost = sharesBn * property.pricePerShare;
  const remaining = property.totalShares - property.sharesSold;

  const allowanceQuery = useReadContract({
    address: CONFIG.paymentToken,
    abi: paymentTokenAbi,
    functionName: "allowance",
    args: address ? [address, CONFIG.propertyFactory] : undefined,
    query: { enabled: !!address },
  });
  const balanceQuery = useReadContract({
    address: CONFIG.paymentToken,
    abi: paymentTokenAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const allowance = (allowanceQuery.data as bigint | undefined) ?? 0n;
  const balance = (balanceQuery.data as bigint | undefined) ?? 0n;

  const approveTx = useWriteContract();
  const approveReceipt = useWaitForTransactionReceipt({ hash: approveTx.data });
  const buyTx = useWriteContract();
  const buyReceipt = useWaitForTransactionReceipt({ hash: buyTx.data });

  useEffect(() => {
    if (approveReceipt.isSuccess) allowanceQuery.refetch();
  }, [approveReceipt.isSuccess]);

  useEffect(() => {
    if (buyReceipt.isSuccess) {
      balanceQuery.refetch();
      allowanceQuery.refetch();
      onSuccess?.();
    }
  }, [buyReceipt.isSuccess]);

  if (!isConnected) return <p className="state">Connect your wallet to buy shares.</p>;
  if (property.status === 1) return <p className="state">This property is sold out.</p>;
  if (property.status === 2) return <p className="state">This property has been delisted.</p>;

  const sharesValid = sharesBn > 0n && sharesBn <= BigInt(remaining);
  const hasBalance = balance >= totalCost;
  const needsApproval = allowance < totalCost;

  const isApproving = approveTx.isPending || approveReceipt.isLoading;
  const isBuying = buyTx.isPending || buyReceipt.isLoading;
  const isBusy = isApproving || isBuying;

  function handleApprove() {
    approveTx.writeContract({
      address: CONFIG.paymentToken,
      abi: paymentTokenAbi,
      functionName: "approve",
      args: [CONFIG.propertyFactory, totalCost],
    });
  }

  function handleBuy() {
    buyTx.writeContract({
      address: CONFIG.propertyFactory,
      abi: propertyFactoryAbi,
      functionName: "buyShares",
      args: [BigInt(property.id), sharesBn],
    });
  }

  return (
    <div className="form">
      <h3>Buy shares</h3>
      <label>
        Number of shares
        <input
          type="number"
          min="1"
          max={remaining}
          step="1"
          value={shareCount}
          onChange={(e) => setShareCount(e.target.value)}
          disabled={isBusy}
        />
      </label>

      <div className="cost-grid">
        <div>
          <span className="cost-label">Total cost</span>
          <strong>{formatEther(totalCost)} rUSD</strong>
        </div>
        <div>
          <span className="cost-label">Your balance</span>
          <span>{formatEther(balance)} rUSD</span>
        </div>
      </div>

      {!sharesValid && (
        <p className="form-msg error">Enter a whole number from 1 to {remaining}.</p>
      )}
      {sharesValid && !hasBalance && (
        <p className="form-msg error">Insufficient rUSD balance. Ask an admin to mint you some.</p>
      )}

      {needsApproval ? (
        <button
          className="wallet-btn primary form-submit"
          onClick={handleApprove}
          disabled={!sharesValid || !hasBalance || isBusy}
        >
          {approveTx.isPending
            ? "Confirm in wallet…"
            : approveReceipt.isLoading
              ? "Approving rUSD…"
              : `Approve ${formatEther(totalCost)} rUSD`}
        </button>
      ) : (
        <button
          className="wallet-btn primary form-submit"
          onClick={handleBuy}
          disabled={!sharesValid || !hasBalance || isBusy}
        >
          {buyTx.isPending
            ? "Confirm in wallet…"
            : buyReceipt.isLoading
              ? "Buying…"
              : `Buy ${shareCount} share${sharesBn === 1n ? "" : "s"}`}
        </button>
      )}

      {(approveTx.error || buyTx.error) && (
        <p className="form-msg error">{formatTxError(approveTx.error ?? buyTx.error)}</p>
      )}
      {buyReceipt.isSuccess && (
        <p className="form-msg success">Purchase confirmed. Check your dashboard.</p>
      )}
    </div>
  );
}
