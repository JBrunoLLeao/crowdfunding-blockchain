import { formatEther } from "ethers";

/** Espelha o enum Status do contrato. */
export const Status = { ACTIVE: 0, SUCCESSFUL: 1, FAILED: 2, CANCELLED: 3, COMPLETED: 4 };

export const STATUS_META = {
  [Status.ACTIVE]: { label: "Ativa", tone: "active" },
  [Status.SUCCESSFUL]: { label: "Meta atingida", tone: "success" },
  [Status.FAILED]: { label: "Meta não atingida", tone: "failed" },
  [Status.CANCELLED]: { label: "Cancelada", tone: "cancelled" },
  [Status.COMPLETED]: { label: "Concluída", tone: "done" },
};

/** Converte wei em ETH legível, com até `maxDecimals` casas. */
export function formatEth(wei, maxDecimals = 4) {
  const value = BigInt(wei);
  const [int, dec = ""] = formatEther(value).split(".");
  const trimmed = dec.slice(0, maxDecimals).replace(/0+$/, "");
  if (value > 0n && int === "0" && trimmed === "") return `<0.${"0".repeat(maxDecimals - 1)}1`;
  return trimmed ? `${int}.${trimmed}` : int;
}

export function shortAddress(address) {
  return address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "";
}

export function sameAddress(a, b) {
  return Boolean(a && b) && a.toLowerCase() === b.toLowerCase();
}

/** Percentual arrecadado (pode passar de 100 quando superfinanciada). */
export function progressPercent(raised, goal) {
  const g = BigInt(goal);
  if (g === 0n) return 0;
  return Number((BigInt(raised) * 10000n) / g) / 100;
}

/** Tempo restante legível; `deadline` e `now` em segundos. */
export function timeLeft(deadline, now) {
  const s = Number(deadline) - Number(now);
  if (s <= 0) return "Encerrada";
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}min`;
  return `${Math.max(m, 1)}min`;
}

export function formatDate(seconds) {
  return new Date(Number(seconds) * 1000).toLocaleString("pt-BR", { dateStyle: "medium", timeStyle: "short" });
}

/**
 * URLs de imagem vêm de usuários: só aceitamos http(s) e ipfs://.
 * Retorna null se a URL não for segura.
 */
export function safeImageUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol === "https:" || u.protocol === "http:") return u.href;
    if (u.protocol === "ipfs:") return `https://ipfs.io/ipfs/${url.slice("ipfs://".length)}`;
  } catch {
    /* URL inválida */
  }
  return null;
}

/** Gradiente determinístico usado como capa quando não há imagem. */
export function coverGradient(id) {
  const hue = (Number(id) * 47) % 360;
  return `linear-gradient(135deg, hsl(${hue} 70% 45%), hsl(${(hue + 50) % 360} 70% 28%))`;
}

export function byteLength(text) {
  return new TextEncoder().encode(text).length;
}
