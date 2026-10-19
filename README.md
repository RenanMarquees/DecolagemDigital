# Fio do Destino

RPG de turnos para celular sobre os deuses antigos. Feito em HTML + JavaScript puro (sem instalar nada).

**Reinos:** Valhala → Olimpo → Inferno → Duat → Abismo do Caos
**Classes:** Guerreiro, Caçador, Oráculo
**Sistemas:** atributos (FOR/DES/INT/VIT), níveis (até 20), inventário, equipamentos (arma/armadura/amuleto), loja, salvamento automático.

**Combate tático (estilo Gloomhaven):** cada luta acontece num mapa de hexágonos com paredes. No seu turno você pode **andar** (até o seu movimento) e fazer **uma ação** (atacar, habilidade, item ou defender), em qualquer ordem. Depois cada inimigo anda até você e ataca. Tem alcance, linha de visão (paredes bloqueiam tiros), habilidades em área, saída 🚪 para fugir e chefes que avisam antes do ataque especial.

## Como jogar

- No computador: `python3 -m http.server 8000` e abra http://localhost:8000
- No celular: publique a pasta (GitHub Pages, Netlify...) e abra o link. No Chrome/Safari use "Adicionar à tela inicial".

## Onde mexer

| Quero mudar... | Arquivo |
|---|---|
| inimigos, itens, reinos, textos da história, habilidades | `js/data.js` |
| fórmulas de dano, nível, loja, regras de batalha | `js/logic.js` |
| mapa, movimento, inimigos andando, salas | `js/tatica.js` |
| telas e botões | `js/ui.js` + `style.css` |

## Testes

- `node tests/sim.js 40` — um robô joga o jogo inteiro 40 vezes por classe e mostra a dificuldade.
- `node tests/smoke.js` — abre o jogo num celular virtual, anda pelo mapa, luta e falha se houver erro (precisa do Playwright).
- `node tests/boss.js` — um herói superforte vence os 5 chefes pela tela e confere história, relíquias e final.
- `python3 tools/gerar-pagina-unica.py saida/index.html` — junta tudo numa página só, para publicar.
