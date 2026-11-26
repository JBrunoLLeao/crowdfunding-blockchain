import { describe, expect, it } from "vitest";
import { friendlyError, MESSAGES } from "./errors";

describe("friendlyError", () => {
  it("traduz erros customizados do contrato", () => {
    expect(friendlyError({ revert: { name: "CampaignEnded" } })).toBe(MESSAGES.CampaignEnded);
    expect(friendlyError({ errorName: "NotCreator" })).toBe(MESSAGES.NotCreator);
  });
  it("reconhece rejeição na carteira", () => {
    expect(friendlyError({ code: "ACTION_REJECTED" })).toMatch(/cancelada/);
    expect(friendlyError({ code: 4001 })).toMatch(/cancelada/);
  });
  it("trata saldo insuficiente e mensagens genéricas", () => {
    expect(friendlyError({ code: "INSUFFICIENT_FUNDS" })).toMatch(/Saldo insuficiente/);
    expect(friendlyError({ shortMessage: "algo deu errado" })).toBe("algo deu errado");
    expect(friendlyError(null)).toBe("Erro desconhecido.");
  });
});
