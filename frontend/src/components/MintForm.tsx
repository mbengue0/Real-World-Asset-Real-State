import { useEffect, useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther, isAddress } from "viem";
import { paymentTokenAbi } from "../abi/PaymentToken";
import { CONFIG } from "../config";
import { formatTxError } from "../lib/errors";

/**
 * Admin-only demo faucet. Mints `amount` rUSD (18 decimals) to `recipient`.
 * Used during the live demo to give testers PaymentToken without real money.
 */
export function MintForm() {
  const { address } = useAccount();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("1000");

  useEffect(() => {
    if (address && !recipient) setRecipient(address);
  }, [address]);

  const mintTx = useWriteContract();
  const mintReceipt = useWaitForTransactionReceipt({ hash: mintTx.data });
  const isBusy = mintTx.isPending || mintReceipt.isLoading;

  const validRecipient = Boolean(recipient && isAddress(recipient));
  const validAmount = Number(amount) > 0;

  function handleMint() {
    if (!validRecipient || !validAmount) return;
    mintTx.writeContract({
      address: CONFIG.paymentToken,
      abi: paymentTokenAbi,
      functionName: "mint",
      args: [recipient as `0x${string}`, parseEther(amount)],
    });
  }

  return (
    <div className="form">
      <h3>Mint test rUSD</h3>
      <p className="muted">Owner-only demo faucet. Mints PaymentToken so testers can buy shares without spending real assets.</p>
      <label>
        Recipient
        <input
          type="text"
          placeholder="0x..."
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          disabled={isBusy}
        />
      </label>
      <label>
        Amount (rUSD)
        <input
          type="number"
          min="0"
          step="1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={isBusy}
        />
      </label>

      <button
        className="wallet-btn primary form-submit"
        onClick={handleMint}
        disabled={!validRecipient || !validAmount || isBusy}
      >
        {mintTx.isPending
          ? "Confirm in wallet…"
          : mintReceipt.isLoading
            ? "Minting…"
            : `Mint ${amount} rUSD`}
      </button>

      {mintTx.error && <p className="form-msg error">{formatTxError(mintTx.error)}</p>}
      {mintReceipt.isSuccess && <p className="form-msg success">Mint confirmed.</p>}
    </div>
  );
}
