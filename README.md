# Fio do Destino

RPG de turnos para celular sobre os deuses antigos. Feito em HTML + JavaScript puro (sem instalar nada).

**Reinos:** Valhala → Olimpo → Inferno → Duat → Abismo do Caos
**Classes:** Guerreiro, Caçador, Oráculo
**Sistemas:** atributos (FOR/DES/INT/VIT), níveis (até 20), inventário, equipamentos (arma/armadura/amuleto), loja, chefes com ataque carregado, salvamento automático.

## Como jogar

- No computador: `python3 -m http.server 8000` e abra http://localhost:8000
- No celular: publique a pasta (GitHub Pages, Netlify...) e abra o link. No Chrome/Safari use "Adicionar à tela inicial".

## Onde mexer

| Quero mudar... | Arquivo |
|---|---|
| inimigos, itens, reinos, textos da história, habilidades | `js/data.js` |
| fórmulas de dano, nível, loja, regras de batalha | `js/logic.js` |
| telas e botões | `js/ui.js` + `style.css` |

## Testes

- `node tests/sim.js 40` — um robô joga o jogo inteiro 40 vezes por classe e mostra a dificuldade.
- `node tests/smoke.js` — abre o jogo num celular virtual e falha se houver erro de JavaScript (precisa do Playwright).
