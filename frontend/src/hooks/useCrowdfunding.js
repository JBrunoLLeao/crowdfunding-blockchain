import { useCallback, useEffect, useMemo, useState } from "react";
import { BrowserProvider, Contract, JsonRpcProvider } from "ethers";
import { abi, CHAINS, DEFAULT_CHAIN_ID, getContractAddress } from "../lib/config";

const PAGE_SIZE = 50;
const POLL_MS = 15_000;

function normalize(c) {
  return {
    id: Number(c.id),
    creator: c.creator,
    title: c.title,
    description: c.description,
    imageUrl: c.imageUrl,
    goal: c.goal,
    totalRaised: c.totalRaised,
    deadline: Number(c.deadline),
    feeBps: Number(c.feeBps),
    status: Number(c.status),
  };
}

/**
 * Camada de dados do app: lê o contrato (mesmo sem carteira, via RPC público)
 * e expõe `send` para transações assinadas pela carteira.
 */
export function useCrowdfunding({ chainId, signer }) {
  const activeChainId = chainId && CHAINS[chainId] ? chainId : DEFAULT_CHAIN_ID;
  const address = getContractAddress(activeChainId);
  const walletOnActiveChain = typeof window !== "undefined" && Boolean(window.ethereum) && chainId === activeChainId;

  const provider = useMemo(
    () =>
      walletOnActiveChain
        ? new BrowserProvider(window.ethereum)
        : new JsonRpcProvider(CHAINS[activeChainId].rpcUrl, activeChainId, { staticNetwork: true }),
    [activeChainId, walletOnActiveChain]
  );
  const readContract = useMemo(() => (address ? new Contract(address, abi, provider) : null), [address, provider]);

  const [state, setState] = useState({
    campaigns: [],
    meta: null,
    loading: true,
    error: null,
    chainNow: 0,
    fetchedAt: 0,
  });

  const refresh = useCallback(
    async ({ silent = false } = {}) => {
      if (!readContract) {
        setState((s) => ({ ...s, campaigns: [], meta: null, loading: false, error: null }));
        return;
      }
      if (!silent) setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const total = Number(await readContract.campaignCount());
        const all = [];
        for (let offset = 0; offset < total; offset += PAGE_SIZE) {
          const [page] = await readContract.getCampaigns(offset, PAGE_SIZE);
          all.push(...page.map(normalize));
        }
        const [owner, feeBps, accruedFees, paused, block] = await Promise.all([
          readContract.owner(),
          readContract.feeBps(),
          readContract.accruedFees(),
          readContract.paused(),
          provider.getBlock("latest"),
        ]);
        setState({
          campaigns: all.reverse(), // mais recentes primeiro
          meta: { owner, feeBps: Number(feeBps), accruedFees, paused },
          loading: false,
          error: null,
          chainNow: block?.timestamp ?? Math.floor(Date.now() / 1000),
          fetchedAt: Date.now(),
        });
      } catch (e) {
        console.error(e);
        setState((s) => ({
          ...s,
          loading: false,
          error: `Não foi possível ler o contrato em ${CHAINS[activeChainId].name}. Verifique se a rede está no ar e o contrato foi implantado.`,
        }));
      }
    },
    [readContract, provider, activeChainId]
  );

  useEffect(() => {
    refresh();
    const timer = setInterval(() => refresh({ silent: true }), POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  /** Quanto a conta `account` já contribuiu para a campanha `id` (wei). */
  const getContribution = useCallback(
    async (id, account) => (readContract && account ? readContract.contributions(id, account) : 0n),
    [readContract]
  );

  /** Envia uma transação (ex.: send("contribute", [id], { value })) e aguarda a confirmação. */
  const send = useCallback(
    async (method, args = [], overrides = {}) => {
      if (!signer) throw new Error("Conecte sua carteira primeiro.");
      if (!address || chainId !== activeChainId) throw new Error("Carteira na rede errada.");
      const contract = new Contract(address, abi, signer);
      const tx = await contract[method](...args, overrides);
      const receipt = await tx.wait();
      await refresh({ silent: true });
      return receipt;
    },
    [signer, address, chainId, activeChainId, refresh]
  );

  return { ...state, address, activeChainId, refresh, send, getContribution };
}
