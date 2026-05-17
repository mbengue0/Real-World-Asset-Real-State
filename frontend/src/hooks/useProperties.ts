import { useReadContract, useReadContracts } from "wagmi";
import { propertyFactoryAbi } from "../abi/PropertyFactory";
import { CONFIG, isContractsConfigured } from "../config";

export type PropertyStatus = 0 | 1 | 2; // Listed / SoldOut / Delisted

export interface OnChainProperty {
  id: number;
  shareContract: `0x${string}`;
  pricePerShare: bigint;
  seller: `0x${string}`;
  listedAt: bigint;
  totalShares: number;
  sharesSold: number;
  status: PropertyStatus;
  metadataURI: string;
}

/**
 * Reads every listed property from the factory in a single batched RPC.
 * Step 1: read `totalProperties()` to know how many entries exist.
 * Step 2: batch-call `getProperty(i)` for i = 1..totalProperties (multicall via wagmi).
 */
export function useProperties() {
  const factoryContract = {
    address: CONFIG.propertyFactory,
    abi: propertyFactoryAbi,
  } as const;

  const total = useReadContract({
    ...factoryContract,
    functionName: "totalProperties",
    query: { enabled: isContractsConfigured() },
  });

  const totalNum = total.data ? Number(total.data) : 0;

  const batch = useReadContracts({
    contracts: Array.from({ length: totalNum }, (_, i) => ({
      ...factoryContract,
      functionName: "getProperty" as const,
      args: [BigInt(i + 1)] as const,
    })),
    query: { enabled: isContractsConfigured() && totalNum > 0 },
  });

  const properties: OnChainProperty[] = (batch.data ?? [])
    .map((entry, i) => {
      if (entry.status !== "success") return null;
      const p = entry.result as unknown as {
        shareContract: `0x${string}`;
        pricePerShare: bigint;
        seller: `0x${string}`;
        listedAt: bigint;
        totalShares: number;
        sharesSold: number;
        status: number;
        metadataURI: string;
      };
      return {
        id: i + 1,
        shareContract: p.shareContract,
        pricePerShare: p.pricePerShare,
        seller: p.seller,
        listedAt: p.listedAt,
        totalShares: Number(p.totalShares),
        sharesSold: Number(p.sharesSold),
        status: p.status as PropertyStatus,
        metadataURI: p.metadataURI,
      };
    })
    .filter((p): p is OnChainProperty => p !== null);

  return {
    properties,
    totalProperties: totalNum,
    isLoading: total.isLoading || batch.isLoading,
    error: total.error ?? batch.error,
    refetch: () => {
      total.refetch();
      batch.refetch();
    },
  };
}
