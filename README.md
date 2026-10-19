# Fio do Destino

RPG de turnos para celular sobre os deuses antigos. Feito em HTML + JavaScript puro (sem instalar nada).

**Reinos:** Valhala → Olimpo → Inferno → Duat → Abismo do Caos
**Classes:** Guerreiro, Caçador, Oráculo
**Sistemas:** atributos (FOR/DES/INT/VIT), níveis (até 20), inventário, equipamentos (arma/armadura/amuleto), loja, salvamento automático.

**Campanha de 20 cenários:** 4 por reino, em sequência (terminar um destrava o próximo; o último de cada reino abre o reino seguinte). Cada cenário tem um **objetivo**:

| Tipo | Objetivo |
|---|---|
| ☠️ matar todos | derrote todos os inimigos da última sala |
| 🧰 baú | termine o turno parado em cima do baú (os inimigos podem ser ignorados) |
| 🏗️ destruir | destrua as estruturas (torres de gelo, altares, portais, estelas, cristais) |
| 👑 chefe | derrote o chefe na arena final |

**Combate tático em 3D (estilo Gloomhaven):** o mapa é de hexágonos, visto em 3D (arraste para mover a câmera, **pinça com dois dedos para aproximar/afastar**, gire com dois dedos ou com o botão ↻, 🎯 volta para o herói). No seu turno você **anda** e faz **uma ação** (atacar, habilidade, item ou defender), em qualquer ordem. As miniaturas ficam em bases coloridas (uma cor por tipo de inimigo, igual às cartas na tela), respiram, andam com pulinho e investem ao atacar.

**Cartas dos inimigos:** a cada rodada cada TIPO de inimigo vira uma carta nova, mostrada na tela antes de você agir: quanto anda (+/−), quanto ataca (+/−), alcance, curar, fortalecer aliados, escudo, empurrar/puxar você. O número no círculo é a **iniciativa** (menor age primeiro). Cada tipo tem o seu baralho (`js/cartas.js`) e os chefes têm baralho próprio, com golpes fortes.

**Empurrar e puxar:** várias habilidades empurram ou puxam o inimigo (martelo, flecha de Apolo, Fúria de Thor, Drenar Alma...). Parede ou outro monstro para o empurrão; armadilhas disparam em quem for jogado nelas; chefes e estruturas resistem. Alguns inimigos também empurram/puxam você.

**Dificuldades:** 🌱 Fácil, ⚔️ Intermediário, 🔥 Difícil e 💀 Expert. Mudam a força dos inimigos, o nível do cenário, o efeito das armadilhas, as recompensas e quanta vida você recupera nas portas. O **nível do cenário** sobe conforme o seu nível (metade, arredondado para cima), e os inimigos acompanham.

**Moedas e baú:** cada monstro derrotado solta uma 🪙 no hexágono onde caiu: pare em cima para saquear (depois de limpar a sala você anda livremente). Cada cenário tem 1 baú; o herói precisa **parar 1 turno** sobre ele. Ao concluir o cenário, você ganha uma **recompensa aleatória** (ouro, XP ou um item). As moedas compram itens no mercador de cada reino.

**Etapas e portas:** cada cenário é dividido por portas. Limpe a sala, a porta se abre e você anda até ela (as armadilhas ainda estão lá!). O chefe sempre fica na última etapa. Você só pode fugir pela entrada, e nunca na arena do chefe.

**Armadilhas por cenário:** quem pisa (você ou um inimigo) dispara uma vez, e ela some. O jogo pede um 2º toque antes de você pisar numa.

| Reino | Armadilha | Efeito |
|---|---|---|
| Valhala | ❄️ gelo | -1 de movimento por 2 rodadas |
| Olimpo | ⚡ raio | dano e paralisa (o movimento acaba ali) |
| Inferno | 🔥 fogo | dano |
| Duat | ☠️ veneno | dano por 3 rodadas |
| Abismo do Caos | 🌀 vazio | dano e drena 30% da mana |

**Miniaturas:** desenhos em SVG (`js/minis.js`) viram "bonecos de pé" sobre bases coloridas 3D (`js/cena3d.js`). **Ainda não são modelos esculpidos em 3D** (isso é um próximo passo possível).

## Como jogar

- No computador: `python3 -m http.server 8000` e abra http://localhost:8000
- No celular: publique a pasta (GitHub Pages, Netlify...) e abra o link. No Chrome/Safari use "Adicionar à tela inicial".

## Onde mexer

| Quero mudar... | Arquivo |
|---|---|
| inimigos, itens, reinos, textos da história, habilidades, dificuldades, equilíbrio geral (`BALANCO`) | `js/data.js` |
| cartas dos inimigos (o que cada tipo faz por rodada) | `js/cartas.js` |
| os 20 cenários, objetivos e etapas | `js/cenarios.js` |
| fórmulas de dano, nível, loja, regras de batalha | `js/logic.js` |
| desenho das salas, portas (D) e armadilhas (A) — é só editar o texto | `js/mapas.js` |
| tipos e efeitos das armadilhas, recuperação nas portas | `js/data.js` (`ARMADILHAS`, `RECUPERA_PORTA`) |
| miniaturas, árvores, colunas, lava... | `js/minis.js` |
| movimento, inimigos andando, empurrar/puxar, moedas, baú, objetivos | `js/tatica.js` |
| o mapa 3D (câmera, zoom, miniaturas, animações) | `js/cena3d.js` (usa o three.js de `js/vendor/`) |
| telas e botões | `js/ui.js` + `style.css` |

## Testes

- `node tests/regras.js` — testa o motor sem navegador: cenários, objetivos, cartas, empurrar/puxar, dificuldades, moedas, baú, armadilhas, portas (rápido).
- `node tests/sim.js 8 todas expert` — um robô joga os 20 cenários e mostra a taxa de vitória por cenário (argumentos: vezes, classe, dificuldade). `BAL_FORCA=1.2 BAL_XP=0.5 node tests/sim.js ...` experimenta o equilíbrio sem mexer no jogo.
- `node tests/mapas.js --ver` — confere todos os mapas (portas, armadilhas, caminhos) e desenha em texto.
- `node tests/smoke.js` — abre o jogo num celular virtual: menus, cenário, mapa 3D, toque, pinça de zoom, cartas, rodadas (precisa do Playwright).
- `node tests/boss.js` — um herói superforte joga os 20 cenários pela tela (objetivos, portas, baú, moedas, chefes, final).
- `python3 tools/gerar-pagina-unica.py saida/index.html` — junta tudo numa página só, para publicar.
