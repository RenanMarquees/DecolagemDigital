# Fio do Destino

RPG de turnos para celular sobre os deuses antigos. Feito em HTML + JavaScript puro (sem instalar nada).

**Reinos:** Valhala → Olimpo → Inferno → Duat → Abismo do Caos
**Classes:** Guerreiro, Caçador, Oráculo
**Sistemas:** **sem atributos**: o herói melhora por **cartas** (1 a cada nível, escolhendo entre 2), níveis (até 20), **5 tipos de item** (cabeça, peito, mãos, pés e mochila), loja, salvamento automático. **Números pequenos:** vida máxima do jogo = 30, dano de 2, 3, 6… e **sem mana**. A única sorte do jogo é o **baralho de modificadores** (abaixo).

**Campanha de 20 cenários:** 4 por reino, em sequência (terminar um destrava o próximo; o último de cada reino abre o reino seguinte). Cada cenário tem um **objetivo**:

| Tipo | Objetivo |
|---|---|
| ☠️ matar todos | derrote todos os inimigos da última sala |
| 🧰 baú | termine o turno parado em cima do baú (os inimigos podem ser ignorados) |
| 🏗️ destruir | destrua as estruturas (torres de gelo, altares, portais, estelas, cristais) |
| 👑 chefe | derrote o chefe na arena final |

**Combate tático em 3D (estilo Gloomhaven):** o mapa de hexágonos ocupa a tela toda (arraste para mover a câmera, **pinça com dois dedos para aproximar/afastar**, gire com ↻, 🎯 volta para o herói). Por cima do mapa ficam os atalhos: a **faixa de iniciativa** no topo, os botões de zoom ao lado e, embaixo, a **mão de cartas** e as ações (⚔️ Atacar, 🎒 Mochila, ⏭️ Encerrar). Nada de rolar a tela. Com o **celular deitado**, o painel vai para a direita e o mapa fica à esquerda. O botão 📋 abre os detalhes (cartas completas dos inimigos, armadilhas, histórico).

**Duas cartas por rodada (estilo Gloomhaven):** você tem uma mão de 12 cartas por classe (`BARALHOS_HEROI` em `js/cartas.js`). Em cada rodada joga **duas**: a primeira dá a **iniciativa** (o menor número age primeiro, inimigos e você se intercalam) e, no seu turno, você usa **uma metade de cada carta** — a de **cima** (⚔️ ataque ou ✚ cura) ou a de **baixo** (👣 movimento e 🛡️ escudo); a outra metade daquela carta se perde (`metadesDaCarta`). **Regra do X:** se a primeira metade usada foi a de cima de uma carta, a segunda tem de ser a de baixo da outra (e vice-versa); se a outra carta não tiver a metade exigida, vale qualquer uma. Dá para atacar e andar, ou andar e atacar. Ao tocar numa carta na mão, o mapa mostra uma **prévia** (azul = aonde chega, vermelho = quem alcança). Com **uma carta só** na mão, vale ela inteira. As cartas dos **monstros ficam ocultas ("?") até você escolher as suas**. Cartas jogadas vão para o descarte; para recuperá-las é preciso descansar (mínimo 2 usadas) e **todo descanso faz uma carta se perder até o fim do cenário** (vale para as etapas seguintes): 💤 **Descanso longo** — iniciativa 99, cura 3 e **você escolhe** qual se perde; ⚡ **Descanso rápido** — uma **sorteada** se perde, as outras voltam à mão e você **ainda joga na mesma rodada**. **Atravessar uma porta devolve as cartas usadas** (as perdidas não). Sem cartas na mão e com menos de 2 no descarte, o herói desmaia (derrota).

**Queimar, custo, elementos e condições:** cartas com 🔥 **queima** são fortes mas somem para sempre (no cenário) depois de usadas; algumas **custam vida** (💔, nunca matam). Cartas **criam elementos** (🔥 fogo, ❄️ gelo, ✨ luz, 🌑 sombra: `elem`) e outras **gastam** o elemento para ganhar dano ou uma condição (`usaElem`); o elemento dura a rodada em que nasceu e a seguinte. **Condições** (`CONDICOES`): 💫 atordoado (perde o turno; herói: só 1 carta), 🕸️ imobilizado (não anda), ⛓️ desarmado (não ataca), 🕶️ cego (ataca com desvantagem), 🩸 ferido (1 de dano por rodada até curar). Valem para o herói e para os monstros (as cartas deles também aplicam).

**Jeito dos monstros** (`JEITOS_IA` / `JEITO_IA`): além da carta, cada monstro comum tem um comportamento: 🐺 bando (+1 de ataque por aliado colado), 🛡️ guardião (não sai do posto), 😡 furioso (mais forte ferido), 😴 dorminhoco (dorme até você chegar a 3 hexágonos ou feri-lo) e 💚 curandeiro (vai curar aliados feridos).

**Salas e objetivos variados** (`js/cenarios.js`): além de matar, abrir o baú e destruir estruturas, há 🔓 **resgatar** um prisioneiro (termine o turno em cima dele e volte à saída) e ⏳ **resistir** N rodadas (reforços a cada 2). Extras de sala: 🔑 **porta trancada** (pegue a chave terminando o turno em cima dela), 🕹️ **alavanca** (desarma as armadilhas e solta moedas), 🌊 **ondas** (quando a sala esvazia chega outra leva) e ⚠️ **terreno que muda** (a cada 3 rodadas o chão racha e surgem armadilhas).

**Escolhas que mudam a história** (`js/eventos.js`): 12 eventos aparecem depois de certos cenários, com 2 ou 3 escolhas que dão ouro, vida, XP, cartas de sorte, itens e **consequências no próximo cenário**. As escolhas mexem em três fios — confiança em **Munin**, em **Hugin** e o **pacto com o Caos** — que mudam as cenas dos chefes e levam a **3 finais** diferentes (`finalDoJogo`). Nos reinos depois de Valhala você **escolhe a ordem dos três primeiros cenários** do reino.

**Extras de jogabilidade:** ↩️ **desfazer o movimento** (enquanto não atacou nem pisou em armadilha), ⏪ **rebobinar a rodada** (1 vez por cenário, também depois de cair; os baralhos são embaralhados de novo) e **batalha guardada**: o jogo salva a batalha a cada ação e o mapa dos reinos oferece **Continuar** se você fechar no meio.

**Sala limpa não é modo livre:** matar todos numa sala do meio não encerra nada. A rodada continua, sem monstros, e você usa as cartas para andar: nas salas do meio, até a **porta**, que só abre quando você **chega** nela. Na **última sala não há volta**: ao cumprir o objetivo o cenário termina na hora. **Moedas e baú precisam ser pegos antes** (pare em cima das moedas; termine o turno em cima do baú): o que ficar para trás se perde.

**Baralho de modificadores (a sorte):** cada ataque — seu e dos monstros — vira **uma carta, automaticamente**, e ela aparece no meio do mapa por um instante (o jogo não espera). As cartas: **+N** soma ao dano, **−N** tira (o golpe nunca fica abaixo de 1), **×2** dobra o dano e **✖ bloqueio** faz o ataque falhar (e o empurrar/puxar também). O baralho só é **embaralhado de novo quando sai um ×2 ou um ✖**. O baralho tem no máximo **15 cartas**; o seu começa com 12 (`BARALHO_BASE` em `js/cartas.js`) e os monstros têm o deles (`BARALHO_INIM`, que muda com a dificuldade: o Fácil não tem ×2 e erra mais). Um ataque em área usa uma carta só. O botão 🎴 (embaixo) e o 📋 mostram o baralho e quais cartas já saíram.

**Conquistas (cartas melhores):** `MARCOS` em `js/cartas.js` — ganhar 100 XP, juntar 50 moedas, derrotar inimigos, abrir baús, vencer cenários e chefes… cada uma coloca uma carta melhor (+1 até +4, ou ×2) no seu baralho. Com 15 cartas, a nova toma o lugar da pior (−2, −1, +0, +1; o ✖ e o ×2 ficam). Veja o progresso em 🧙 Personagem.

**Monstros começam perto** (de 3 a 6 hexágonos; o chefe de 5 a 7) e andam menos (como em Gloomhaven: Botões e Bichinhos).

**Moedas:** cada monstro solta moedas no chão (termine o turno em cima, como no baú, para pegar). Elas viram ouro **no fim do cenário**: **2 de ouro por moeda até o cenário 10 e 3 do cenário 11 em diante** (se você cair, as moedas que carregava ficam para trás; só valem as que você pegou antes de sair da sala). **Itens por etapa:** os mercadores liberam equipamentos melhores **a cada 5 cenários concluídos** (nível 1; 5 cenários → nível 2; 10 → 3; 15 → 4), e baús e recompensas também só dão equipamento do nível liberado.

**Cartas por nível:** a cada nível você escolhe **1 de 2 cartas novas** (`MODELOS_NIVEL` em `js/cartas.js`; os números crescem com o nível) e **a outra se perde para sempre**. A coleção cresce, mas a **mão de cada cenário tem de 6 a 10 cartas**: monte a sua em 🧙 Personagem. A vida cresce um pouco por nível (máx. 30).

**Equipamento de uso único:** cabeça, peito, pés e mãos **não dão bônus fixos**: cada peça vestida pode ser **usada 1 vez por cenário**, de graça, no seu turno (🎒 Itens), e dá cura, escudo, +dano, +movimento ou +alcance conforme o item. Depois fica gasta até o cenário seguinte.

**Desvantagem:** se a carta que você jogou ataca **à distância** (alcance maior que 1) e o inimigo que você **ataca** está **colado** em você, o ataque tem desvantagem (ter um monstro ao lado não basta: se você atacar **outro** que não esteja colado, não há desvantagem): viram **duas** cartas de sorte e vale a **pior**. Vale também para os monstros atiradores, que por isso sempre tentam se **afastar** de você antes de atirar (se não houver lugar, atiram assim mesmo).

**Empurrar e puxar:** **você escolhe** para onde o inimigo vai (toque num dos hexágonos dourados, ou deixe onde está); cada passo precisa afastar (empurrar) ou aproximar (puxar). Os **monstros** que empurram/puxam você escolhem **sempre o pior para você**: armadilha primeiro, depois o lugar com mais monstros em volta.

**Mover só uma vez:** o movimento da carta é usado de uma vez só; se você andar menos do que a carta permite, o resto **se perde**. **Moedas, como o baú:** só são pegas se você **terminar o turno** em cima delas.

**Salas pequenas e monstros em grupo:** as salas são de 8×8 hexágonos (feitas para jogar sozinho), com 3 a 5 monstros por sala (o chefe vem com 3 capangas), que nascem **espalhados de forma variada** (alguns em grupo, outros sozinhos, de 3 a 8 hexágonos do herói) e andam menos.

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

**História:** o prólogo apresenta a Marca do Tecelão e os corvos Hugin e Munin; depois de **cada chefe** há uma cena de 4 a 5 páginas com pistas e reviravoltas (Fenrir, Ares, Hades e Set), um chefe final (o Caos Primordial) e um epílogo. Os textos ficam em `js/data.js` (`HISTORIA_PROLOGO`, `falaAntes`/`falaDepois` de cada chefe, `HISTORIA_FINAL`).

**Vida em número:** a vida do herói e dos monstros aparece como **número** (em cima de cada miniatura e no painel). As cartas dos monstros aparecem numa fileira legível depois que você escolhe a sua.

**Tutorial:** os 3 primeiros cenários (Valhala) ensinam o jogo com cartões que aparecem na hora certa e esperam você fazer a ação: câmera e zoom, objetivo, faixa de iniciativa, escolher a carta, andar, atacar, encerrar o turno, vida e itens livres, armadilhas, moedas, portas, loja, inventário, pontos de atributo, empurrar/puxar, baú e estruturas. Dá para pular (✕ no cartão) e rever depois pelo link no mapa dos reinos. Os textos ficam em `js/tutorial.js`.

## Como jogar

- No computador: `python3 -m http.server 8000` e abra http://localhost:8000
- No celular: publique a pasta (GitHub Pages, Netlify...) e abra o link. No Chrome/Safari use "Adicionar à tela inicial".

## Onde mexer

| Quero mudar... | Arquivo |
|---|---|
| inimigos, itens, reinos, textos da história, habilidades, dificuldades, equilíbrio geral (`BALANCO`) | `js/data.js` |
| cartas dos inimigos (o que cada tipo faz por rodada) | `js/cartas.js` |
| os 20 cenários, objetivos, etapas e extras de sala (chave, alavanca, ondas, terreno) | `js/cenarios.js` |
| eventos de escolha, cenas extras dos chefes e os 3 finais | `js/eventos.js` |
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
