import { useCallback, useEffect, useState } from "react";
import { BrowserProvider, getAddress } from "ethers";
import { CHAINS } from "../lib/config";

/** Conexão com a carteira (MetaMask ou qualquer provedor EIP-1193). */
export function useWallet() {
  const [state, setState] = useState({ account: null, chainId: null, signer: null });
  const hasWallet = typeof window !== "undefined" && Boolean(window.ethereum);

  const sync = useCallback(async () => {
    if (!window.ethereum) return;
    try {
      // Um BrowserProvider novo a cada sincronização evita o erro "network changed" do ethers
      const provider = new BrowserProvider(window.ethereum);
      const [accounts, network] = await Promise.all([provider.send("eth_accounts", []), provider.getNetwork()]);
      const signer = accounts.length ? await provider.getSigner(accounts[0]) : null;
      setState({
        account: accounts.length ? getAddress(accounts[0]) : null,
        chainId: Number(network.chainId),
        signer,
      });
    } catch (e) {
      console.error("Falha ao sincronizar a carteira:", e);
    }
  }, []);

  useEffect(() => {
    sync();
    const eth = window.ethereum;
    if (!eth?.on) return undefined;
    eth.on("accountsChanged", sync);
    eth.on("chainChanged", sync);
    return () => {
      eth.removeListener("accountsChanged", sync);
      eth.removeListener("chainChanged", sync);
    };
  }, [sync]);

  const connect = useCallback(async () => {
    if (!window.ethereum) throw new Error("Nenhuma carteira Web3 encontrada. Instale a MetaMask.");
    await new BrowserProvider(window.ethereum).send("eth_requestAccounts", []);
    await sync();
  }, [sync]);

  const switchChain = useCallback(async (targetId) => {
    const chain = CHAINS[targetId];
    const chainId = `0x${targetId.toString(16)}`;
    try {
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId }] });
    } catch (e) {
      const notAdded = e?.code === 4902 || e?.error?.code === 4902;
      if (!notAdded) throw e;
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId,
            chainName: chain.name,
            nativeCurrency: chain.currency,
            rpcUrls: [chain.rpcUrl],
            blockExplorerUrls: chain.explorer ? [chain.explorer] : [],
          },
        ],
      });
    }
  }, []);

  return { ...state, hasWallet, connect, switchChain };
}
