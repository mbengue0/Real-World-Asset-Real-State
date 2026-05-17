import { MintForm } from "../components/MintForm";
import { ListPropertyForm } from "../components/ListPropertyForm";
import { useIsAdmin } from "../hooks/useIsAdmin";
import { isContractsConfigured } from "../config";

export function Admin() {
  const isAdmin = useIsAdmin();

  if (!isContractsConfigured()) {
    return (
      <div className="state">
        <h2>Contracts not configured</h2>
        <p>
          Set <code>VITE_PAYMENT_TOKEN_ADDRESS</code> and{" "}
          <code>VITE_PROPERTY_FACTORY_ADDRESS</code> in <code>frontend/.env</code>.
        </p>
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="state">
        <h2>Admin only</h2>
        <p>Connect with the wallet that owns the PropertyFactory contract.</p>
      </div>
    );
  }
  return (
    <section className="admin">
      <h1>Admin</h1>
      <MintForm />
      <ListPropertyForm />
    </section>
  );
}
