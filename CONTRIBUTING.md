# Contribuindo

Contribuições são bem-vindas! 🎉

1. Faça um fork e crie uma branch: `git checkout -b feat/minha-ideia`
2. Instale tudo: `npm install && npm run frontend:install`
3. Faça suas alterações **com testes**.
4. Valide localmente:
   ```bash
   npm run lint:sol
   npm test
   npm run frontend:test
   npm run frontend:build
   ```
5. Se alterou o contrato, atualize o ABI do frontend: `npm run abi`.
6. Abra o Pull Request (o template traz um checklist).

## Padrões

- Solidity: `^0.8.24`, erros customizados (sem `require` com string), NatSpec nas funções públicas.
- Toda função que envia ETH deve seguir Checks-Effects-Interactions e usar `nonReentrant`.
- Commits no estilo [Conventional Commits](https://www.conventionalcommits.org/pt-br/) (`feat:`, `fix:`, `docs:`…).
