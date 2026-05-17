import { useQuery } from "@tanstack/react-query";
import { ipfsToHttpUrl } from "../lib/ipfs";

export interface PropertyMetadata {
  name: string;
  description: string;
  location: {
    address?: string;
    city: string;
    country: string;
  };
  imageURI: string;
  yearBuilt?: number;
  type?: "residential" | "commercial" | string;
  areaSqM?: number;
}

/**
 * Resolve an ipfs:// URI to its JSON metadata. React-Query caches the result
 * across re-renders and between components — fetching the same CID twice in
 * one session hits memory, not the network.
 */
export function useIpfsMetadata(uri: string | undefined) {
  return useQuery<PropertyMetadata>({
    queryKey: ["ipfs-metadata", uri],
    queryFn: async () => {
      if (!uri) throw new Error("No URI");
      const httpUrl = ipfsToHttpUrl(uri);
      const res = await fetch(httpUrl);
      if (!res.ok) throw new Error(`IPFS fetch failed: ${res.status}`);
      return (await res.json()) as PropertyMetadata;
    },
    enabled: Boolean(uri),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
