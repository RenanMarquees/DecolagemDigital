# Fio do Destino

RPG de turnos para celular sobre os deuses antigos. Feito em HTML + JavaScript puro (sem instalar nada).

**Reinos:** Valhala → Olimpo → Inferno → Duat → Abismo do Caos
**Classes:** Guerreiro, Caçador, Oráculo
**Sistemas:** atributos (FOR/DES/INT/VIT), níveis (até 20), **5 tipos de item** (cabeça, peito, mãos, pés e mochila), loja, salvamento automático. **Números pequenos:** vida máxima do jogo = 30, dano de 2, 3, 6… e **sem mana**. A única sorte do jogo é o **baralho de modificadores** (abaixo).

**Campanha de 20 cenários:** 4 por reino, em sequência (terminar um destrava o próximo; o último de cada reino abre o reino seguinte). Cada cenário tem um **objetivo**:

| Tipo | Objetivo |
|---|---|
| ☠️ matar todos | derrote todos os inimigos da última sala |
| 🧰 baú | termine o turno parado em cima do baú (os inimigos podem ser ignorados) |
| 🏗️ destruir | destrua as estruturas (torres de gelo, altares, portais, estelas, cristais) |
| 👑 chefe | derrote o chefe na arena final |

**Combate tático em 3D (estilo Gloomhaven):** o mapa de hexágonos ocupa a tela toda (arraste para mover a câmera, **pinça com dois dedos para aproximar/afastar**, gire com ↻, 🎯 volta para o herói). Por cima do mapa ficam os atalhos: a **faixa de iniciativa** no topo, os botões de zoom ao lado e, embaixo, a **mão de cartas** e as ações (⚔️ Atacar, 🎒 Mochila, ⏭️ Encerrar). Nada de rolar a tela. Com o **celular deitado**, o painel vai para a direita e o mapa fica à esquerda. O botão 📋 abre os detalhes (cartas completas dos inimigos, armadilhas, histórico).

**Cartas de iniciativa do herói:** você tem uma mão de 10 cartas por classe (`BARALHOS_HEROI` em `js/cartas.js`). Em cada rodada joga **uma**: ela define o seu turno (andar, atacar, alcance, empurrar/puxar, escudo, cura…) e o número dourado é a sua **iniciativa**. Quem tem o menor número age primeiro — inimigos e você se intercalam. As cartas dos **monstros ficam ocultas ("?") até você escolher a sua**: primeiro você escolhe às cegas, depois elas são reveladas e a ordem aparece. A carta jogada vai para o descarte. Para recuperar as usadas é preciso descansar (mínimo 2 cartas usadas), e **todo descanso faz uma carta se perder até o fim do cenário** (vale para as etapas seguintes também): 💤 **Descanso longo** — iniciativa 99, cura 3 de vida e **você escolhe** qual carta usada se perde; ⚡ **Descanso rápido** — uma carta usada **sorteada** se perde, as outras voltam à mão e você **ainda joga na mesma rodada** (1 por rodada). Sem cartas na mão e com menos de 2 no descarte, o herói desmaia (derrota). As habilidades da classe **são as cartas** (sem mana).

**Sala limpa não é modo livre:** matar todos numa sala do meio não encerra nada. A rodada continua, sem monstros, e você usa as cartas para andar: nas salas do meio, até a **porta**, que só abre quando você **chega** nela. Na **última sala não há volta**: ao cumprir o objetivo o cenário termina na hora. **Moedas e baú precisam ser pegos antes** (pare em cima das moedas; termine o turno em cima do baú): o que ficar para trás se perde.

**Baralho de modificadores (a sorte):** cada ataque — seu e dos monstros — vira **uma carta, automaticamente**, e ela aparece no meio do mapa por um instante (o jogo não espera). As cartas: **+N** soma ao dano, **−N** tira (o golpe nunca fica abaixo de 1), **×2** dobra o dano e **✖ bloqueio** faz o ataque falhar (e o empurrar/puxar também). O baralho só é **embaralhado de novo quando sai um ×2 ou um ✖**. O baralho tem no máximo **15 cartas**; o seu começa com 12 (`BARALHO_BASE` em `js/cartas.js`) e os monstros têm o deles (`BARALHO_INIM`, que muda com a dificuldade: o Fácil não tem ×2 e erra mais). Um ataque em área usa uma carta só. O botão 🎴 (embaixo) e o 📋 mostram o baralho e quais cartas já saíram.

**Conquistas (cartas melhores):** `MARCOS` em `js/cartas.js` — ganhar 100 XP, juntar 50 moedas, derrotar inimigos, abrir baús, vencer cenários e chefes… cada uma coloca uma carta melhor (+1 até +4, ou ×2) no seu baralho. Com 15 cartas, a nova toma o lugar da pior (−2, −1, +0, +1; o ✖ e o ×2 ficam). Veja o progresso em 🧙 Personagem.

**Monstros começam perto** (de 3 a 6 hexágonos; o chefe de 5 a 7) e andam menos (como em Gloomhaven: Botões e Bichinhos).

**Moedas:** cada monstro solta moedas no chão (pare em cima para pegar). Elas viram ouro **no fim do cenário**: **2 de ouro por moeda até o cenário 10 e 3 do cenário 11 em diante** (se você cair, as moedas que carregava ficam para trás; só valem as que você pegou antes de sair da sala). **Itens por etapa:** os mercadores liberam equipamentos melhores **a cada 5 cenários concluídos** (nível 1; 5 cenários → nível 2; 10 → 3; 15 → 4), e baús e recompensas também só dão equipamento do nível liberado.

**Itens:** usar um item da mochila **não gasta a sua jogada**. Slots: 1 de cabeça, 1 de peito, 1 de pés, 2 de mãos, e a **mochila** começa com 2 lugares e vai a 5 (níveis 5, 10 e 15).

**Cartas dos inimigos:** a cada rodada cada TIPO de inimigo vira uma carta nova, mostrada na tela antes de você agir: quanto anda (+/−), quanto ataca (+/−), alcance, curar, fortalecer aliados, escudo, empurrar/puxar você. O número no círculo é a **iniciativa** (menor age primeiro). Os números mostrados na faixa de iniciativa já são o resultado final (vida e ataque do inimigo + a carta). Cada tipo tem o seu baralho (`js/cartas.js`) e os chefes têm baralho próprio, com golpes fortes.

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
| Abismo do Caos | 🌀 vazio | dano e você perde 1 carta da mão |

**Miniaturas 3D detalhadas:** cada herói, monstro, chefe e estrutura é um modelo 3D esculpido por código (centenas de peças por monstro: chifres, costelas, correntes, asas com penas, cicatrizes, tochas…), com texturas de pele/metal/pelo, contorno de miniatura pintada e animações (andar, golpear, asas, mandíbulas, capas). Os modelos ficam em `js/modelos3d/` (um arquivo por reino). Quer ainda mais detalhe? Dá para trocar qualquer personagem por um arquivo `.glb` gerado em serviços como Meshy ou Tripo — veja `docs/MINIATURAS.md`.

**Tutorial:** os 3 primeiros cenários (Valhala) ensinam o jogo com cartões que aparecem na hora certa e esperam você fazer a ação: câmera e zoom, objetivo, faixa de iniciativa, escolher a carta, andar, atacar, encerrar o turno, vida e itens livres, armadilhas, moedas, portas, loja, inventário, pontos de atributo, empurrar/puxar, baú e estruturas. Dá para pular (✕ no cartão) e rever depois pelo link no mapa dos reinos. Os textos ficam em `js/tutorial.js`.

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
| o mapa 3D (câmera, zoom, animações) | `js/cena3d.js` (usa o three.js de `js/vendor/`) |
| a aparência 3D de cada monstro, herói e estrutura | `js/modelos3d/<reino>.js` (um bloco por personagem; ferramentas em `js/modelos3d.js`) e `docs/MINIATURAS.md` |
| as cartas do herói (baralho de cada classe) | `js/cartas.js` (`BARALHOS_HEROI`) |
| textos e passos do tutorial | `js/tutorial.js` (lista `PASSOS`) |
| telas e botões | `js/ui.js` + `style.css` |

## Testes

- `node tests/regras.js` — testa o motor sem navegador: cartas de iniciativa, ordem de turnos, baralho de modificadores, conquistas, moedas, itens/slots, cenários, objetivos, empurrar/puxar, dificuldades, moedas, baú, armadilhas, portas (rápido).
- `node tests/sim.js 8 todas expert` — um robô joga os 20 cenários e mostra a taxa de vitória por cenário (argumentos: vezes, classe, dificuldade). `BAL_FORCA=0.6 BAL_FPN=0.03 RESUMO=1 node tests/sim.js 20 todas` experimenta o equilíbrio sem mexer no jogo (RESUMO=1 mostra uma linha por classe/dificuldade).
- `node tests/mapas.js --ver` — confere todos os mapas (portas, armadilhas, caminhos) e desenha em texto.
- `node tests/smoke.js` — abre o jogo num celular virtual: menus, cenário, mapa 3D, toque, pinça de zoom, cartas, atalhos sem rolar a tela, rodadas (precisa do Playwright).
- `node tests/tutorial.js` — um jogador novo segue os cartões do tutorial nos cenários 1, 2 e 3 (inclui loja e inventário).
- `node tests/boss.js` — um herói superforte joga os 20 cenários pela tela (objetivos, portas, baú, moedas, chefes, final).
- `python3 tools/gerar-pagina-unica.py saida/index.html` — junta tudo numa página só, para publicar.
