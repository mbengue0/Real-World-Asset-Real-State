import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { useIsAdmin } from "../hooks/useIsAdmin";

export type View = "catalogue" | "dashboard" | "detail" | "admin";

interface HeaderProps {
  view: View;
  onViewChange: (v: View) => void;
}

export function Header({ view, onViewChange }: HeaderProps) {
  const { address, isConnected, chain } = useAccount();
  const { connect, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const isAdmin = useIsAdmin();

  function short(addr?: string) {
    if (!addr) return "";
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
  }

  // Property detail is a sub-view of catalogue — keep that tab highlighted.
  const catalogueActive = view === "catalogue" || view === "detail";

  return (
    <header className="header">
      <div className="brand">RWA Real Estate</div>
      <nav>
        <button
          className={catalogueActive ? "active" : ""}
          onClick={() => onViewChange("catalogue")}
        >
          Catalogue
        </button>
        <button
          className={view === "dashboard" ? "active" : ""}
          onClick={() => onViewChange("dashboard")}
        >
          Dashboard
        </button>
        {isAdmin && (
          <button
            className={view === "admin" ? "active" : ""}
            onClick={() => onViewChange("admin")}
          >
            Admin
          </button>
        )}
      </nav>
      <div className="wallet">
        {isConnected ? (
          <button className="wallet-btn" onClick={() => disconnect()}>
            <span className="dot" />
            {short(address)} · {chain?.name ?? "Unknown chain"}
          </button>
        ) : (
          <button
            className="wallet-btn primary"
            onClick={() => connect({ connector: injected() })}
            disabled={isConnecting}
          >
            {isConnecting ? "Connecting…" : "Connect Wallet"}
          </button>
        )}
      </div>
    </header>
  );
}
