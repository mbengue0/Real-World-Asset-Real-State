import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { formatEther } from "viem";
import { paymentTokenAbi } from "../abi/PaymentToken";
import { propertyShareAbi } from "../abi/PropertyShare";
import { useProperties } from "../hooks/useProperties";
import { useIpfsMetadata } from "../hooks/useIpfsMetadata";
import { CONFIG, isContractsConfigured } from "../config";

export function Dashboard() {
  const { address, isConnected } = useAccount();
  const { properties } = useProperties();

  const { data: paymentBalance } = useReadContract({
    address: CONFIG.paymentToken,
    abi: paymentTokenAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && isContractsConfigured() },
  });

  const shareBalances = useReadContracts({
    contracts: properties.map((p) => ({
      address: p.shareContract,
      abi: propertyShareAbi,
      functionName: "balanceOf" as const,
      args: [address!] as const,
    })),
    query: { enabled: !!address && properties.length > 0 },
  });

  if (!isContractsConfigured()) {
    return (
      <div className="state">
        <h2>Contracts not configured</h2>
        <p>
          Set <code>VITE_PAYMENT_TOKEN_ADDRESS</code> in <code>frontend/.env</code> to view your
          dashboard.
        </p>
      </div>
    );
  }

  if (!isConnected) {
    return <p className="state">Connect your wallet to view your dashboard.</p>;
  }

  const holdings = (shareBalances.data ?? [])
    .map((entry, i) => ({
      property: properties[i],
      balance: entry.status === "success" ? (entry.result as bigint) : 0n,
    }))
    .filter((h) => h.balance > 0n);

  return (
    <section className="dashboard">
      <h1>Your Holdings</h1>

      <div className="card">
        <h2>Payment Token (rUSD)</h2>
        <p className="big-num">
          {paymentBalance !== undefined ? Number(formatEther(paymentBalance)).toLocaleString() : "—"}
        </p>
      </div>

      <h2 className="section-title">Property Shares</h2>
      {holdings.length === 0 ? (
        <p className="state">You don't hold any property shares yet.</p>
      ) : (
        <div className="holdings-list">
          {holdings.map(({ property, balance }) => (
            <HoldingRow key={property.id} property={property} balance={balance} />
          ))}
        </div>
      )}
    </section>
  );
}

function HoldingRow({ property, balance }: { property: any; balance: bigint }) {
  const { data: meta } = useIpfsMetadata(property.metadataURI);
  const pct = property.totalShares > 0 ? (Number(balance) / property.totalShares) * 100 : 0;
  return (
    <div className="holding">
      <div>
        <strong>{meta?.name ?? `Property #${property.id}`}</strong>
        <p className="muted">
          {meta?.location ? `${meta.location.city}, ${meta.location.country}` : property.metadataURI}
        </p>
      </div>
      <div className="balance">
        <div className="big-num">{Number(balance).toLocaleString()}</div>
        <p className="muted">
          {pct.toFixed(2)}% ownership · {property.totalShares.toLocaleString()} total
        </p>
      </div>
    </div>
  );
}
