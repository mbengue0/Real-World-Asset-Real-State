import { useAccount, useReadContract } from "wagmi";
import { propertyFactoryAbi } from "../abi/PropertyFactory";
import { CONFIG, isContractsConfigured } from "../config";

/**
 * True iff the connected wallet matches `PropertyFactory.owner()`.
 * Drives admin-only UI visibility (Admin tab, mint form, list-property form).
 * Address comparison is case-insensitive because EIP-55 checksums differ.
 */
export function useIsAdmin(): boolean {
  const { address } = useAccount();
  const { data: owner } = useReadContract({
    address: CONFIG.propertyFactory,
    abi: propertyFactoryAbi,
    functionName: "owner",
    query: { enabled: isContractsConfigured() },
  });
  if (!address || !owner) return false;
  return address.toLowerCase() === (owner as string).toLowerCase();
}
