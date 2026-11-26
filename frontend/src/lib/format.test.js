import { describe, expect, it } from "vitest";
import { Status, byteLength, coverGradient, formatEth, progressPercent, safeImageUrl, sameAddress, shortAddress, timeLeft } from "./format";

const ETH = 10n ** 18n;

describe("formatEth", () => {
  it("formata valores comuns", () => {
    expect(formatEth(0n)).toBe("0");
    expect(formatEth(ETH)).toBe("1");
    expect(formatEth(ETH + ETH / 2n)).toBe("1.5");
    expect(formatEth(123456789012345678n)).toBe("0.1234");
  });
  it("sinaliza valores minúsculos", () => {
    expect(formatEth(1n)).toBe("<0.0001");
  });
});

describe("progressPercent", () => {
  it("calcula percentuais, inclusive acima de 100", () => {
    expect(progressPercent(5n * ETH, 10n * ETH)).toBe(50);
    expect(progressPercent(25n * ETH, 10n * ETH)).toBe(250);
    expect(progressPercent(0n, 10n * ETH)).toBe(0);
    expect(progressPercent(1n, 0n)).toBe(0);
  });
});

describe("timeLeft", () => {
  it("formata a contagem regressiva", () => {
    expect(timeLeft(1000, 1000)).toBe("Encerrada");
    expect(timeLeft(1000 + 2 * 86400 + 3 * 3600, 1000)).toBe("2d 3h");
    expect(timeLeft(1000 + 3600 + 5 * 60, 1000)).toBe("1h 5min");
    expect(timeLeft(1010, 1000)).toBe("1min");
  });
});

describe("safeImageUrl", () => {
  it("aceita http(s) e ipfs", () => {
    expect(safeImageUrl("https://exemplo.com/a.png")).toBe("https://exemplo.com/a.png");
    expect(safeImageUrl("ipfs://bafy123")).toBe("https://ipfs.io/ipfs/bafy123");
  });
  it("rejeita esquemas perigosos e entradas inválidas", () => {
    expect(safeImageUrl("javascript:alert(1)")).toBeNull();
    expect(safeImageUrl("data:text/html,<script>")).toBeNull();
    expect(safeImageUrl("não é url")).toBeNull();
    expect(safeImageUrl("")).toBeNull();
  });
});

describe("utilitários", () => {
  it("compara endereços sem diferenciar maiúsculas", () => {
    expect(sameAddress("0xAbC", "0xabc")).toBe(true);
    expect(sameAddress("0xabc", null)).toBe(false);
  });
  it("encurta endereços", () => {
    expect(shortAddress("0x1234567890abcdef1234567890abcdef12345678")).toBe("0x1234…5678");
  });
  it("conta bytes (acentos valem 2)", () => {
    expect(byteLength("abc")).toBe(3);
    expect(byteLength("ç")).toBe(2);
  });
  it("gera gradiente determinístico e expõe o enum", () => {
    expect(coverGradient(1)).toBe(coverGradient(1));
    expect(coverGradient(1)).not.toBe(coverGradient(2));
    expect(Status.COMPLETED).toBe(4);
  });
});
