# Fio do Destino

RPG de turnos para celular sobre os deuses antigos. Feito em HTML + JavaScript puro (sem instalar nada).

**Reinos:** Valhala → Olimpo → Inferno → Duat → Abismo do Caos
**Classes:** Guerreiro, Caçador, Oráculo
**Sistemas:** atributos (FOR/DES/INT/VIT), níveis (até 20), inventário, equipamentos (arma/armadura/amuleto), loja, salvamento automático.

**Combate tático (estilo Gloomhaven):** cada luta acontece num mapa de hexágonos com paredes. No seu turno você pode **andar** (até o seu movimento) e fazer **uma ação** (atacar, habilidade, item ou defender), em qualquer ordem. Depois cada inimigo anda até você e ataca. Tem alcance, linha de visão (árvores, colunas e pedras bloqueiam tiros, mas lava, fendas e nuvens não), habilidades em área, saída 🚪 para fugir e chefes que avisam antes do ataque especial.

**Mapas temáticos:** 13 salas de 12×11 hexágonos, cada uma com nome e visual do seu cenário (Salão dos Einherjar, Floresta Gelada de Yggdrasil, Jardins de Hera, Rio Flegetonte, Salão de Osíris, Pirâmide de Set...). Cada chefe tem a sua arena. O mapa rola com o dedo, e o botão 🔍 muda o zoom e o 🎯 volta para o herói.

**Etapas e portas:** cada expedição é dividida por portas. Você limpa a primeira sala, a porta se abre e você anda até ela (as armadilhas ainda estão no caminho!). A etapa seguinte tem outra sala e mais inimigos, e você recupera 15% da vida e da mana ao atravessar. Explorar tem 2 etapas. Desafiar um chefe tem 3, e o chefe **sempre** fica na última (na arena dele). Você só pode fugir pela entrada, e nunca na arena do chefe.

**Armadilhas por cenário:** quem pisa (você ou um inimigo) dispara uma vez, e ela some. Dá para atrair inimigos para elas. O jogo avisa e pede um 2º toque antes de você pisar numa.

| Cenário | Armadilha | Efeito |
|---|---|---|
| Valhala | ❄️ gelo | -1 de movimento por 2 rodadas |
| Olimpo | ⚡ raio | dano e paralisa (o movimento acaba ali) |
| Inferno | 🔥 fogo | dano |
| Duat | ☠️ veneno | dano por 3 rodadas |
| Abismo do Caos | 🌀 vazio | dano e drena 30% da mana |

**Miniaturas:** o herói (3 classes) e os 21 inimigos são desenhados em SVG (`js/minis.js`), sem depender de emoji.

## Como jogar

- No computador: `python3 -m http.server 8000` e abra http://localhost:8000
- No celular: publique a pasta (GitHub Pages, Netlify...) e abra o link. No Chrome/Safari use "Adicionar à tela inicial".

## Onde mexer

| Quero mudar... | Arquivo |
|---|---|
| inimigos, itens, reinos, textos da história, habilidades | `js/data.js` |
| fórmulas de dano, nível, loja, regras de batalha | `js/logic.js` |
| desenho das salas, portas (D) e armadilhas (A) — é só editar o texto | `js/mapas.js` |
| tipos e efeitos das armadilhas, recuperação nas portas | `js/data.js` (`ARMADILHAS`, `RECUPERA_PORTA`) |
| miniaturas, árvores, colunas, lava... | `js/minis.js` |
| movimento, inimigos andando, regras do mapa | `js/tatica.js` |
| telas e botões | `js/ui.js` + `style.css` |

## Testes

- `node tests/sim.js 40` — um robô joga o jogo inteiro 40 vezes por classe e mostra a dificuldade.
- `node tests/regras.js` — testa armadilhas, portas, etapas e combate direto no motor (rápido, sem navegador).
- `node tests/mapas.js --ver` — confere todos os mapas (portas, armadilhas, caminhos) e desenha em texto.
- `node tests/smoke.js` — abre o jogo num celular virtual, anda pelo mapa, luta e falha se houver erro (precisa do Playwright).
- `node tests/boss.js` — um herói superforte percorre as expedições de todos os reinos pela tela (salas, portas, chefe na última etapa) e confere história, relíquias e final.
- `python3 tools/gerar-pagina-unica.py saida/index.html` — junta tudo numa página só, para publicar.
