'use strict';
/* ============================================================
   TUTORIAL — os 3 primeiros cenários de Valhala ensinam o jogo passo a passo.

   Como funciona (para quem está começando):
   - cada PASSO é um cartãozinho que aparece no topo da tela na hora certa;
   - `tela` diz onde ele aparece (mapa, reino, briefing, batalha, loja);
   - `quando` diz em que situação ele aparece;
   - `esperar` (opcional) é a ação que o jogador precisa fazer: quando acontecer, o passo se conclui sozinho.
     Sem `esperar`, o cartão tem o botão "Entendi";
   - `destaque` é o botão/área que fica piscando;
   - os passos vistos ficam salvos no jogo (P.tutorial.feitos), então cada um aparece uma vez só.
   Para mudar um texto ou adicionar um passo, é só editar a lista PASSOS logo abaixo.
   ============================================================ */
const Tutorial = (() => {
  const cen = () => (typeof T !== 'undefined' && T && T.exp ? T.exp.cenario.id : 0);   // cenário em batalha
  const ok = id => !!(P && P.tutorial && P.tutorial.feitos[id]);   // este PASSO já foi concluído?
  const feito = ev => !!(P && P.tutorial && P.tutorial.feitos['ev_' + ev]);
  const naBatalha = id => typeof T !== 'undefined' && T && T.exp && T.exp.cenario.id === id && !T.livre;

  const PASSOS = [
    /* ---------- mapa e reino ---------- */
    { id: 'm_bemvindo', tela: 'mapa', titulo: '🧶 Bem-vindo ao Fio do Destino!',
      texto: 'Este é o mapa dos reinos. Cada reino tem 4 cenários. Os 3 primeiros são um tutorial: eu vou te guiar. A dificuldade já está em Fácil (você pode trocar aqui quando quiser). Toque em Valhala.',
      destaque: '[data-a=reino][data-id=valhala]', esperar: () => feito('reino') },
    { id: 'r_cen1', tela: 'reino', quando: () => !P.cenarios[1], titulo: '📜 Cenários',
      texto: 'Cada cenário é uma missão com um objetivo. Eles abrem em ordem: terminar um libera o próximo. Toque no cenário 1.',
      destaque: '[data-a=cenario][data-id="1"]', esperar: () => feito('cenario1') },

    /* ---------- cenário 1: matar todos ---------- */
    { id: 'br1', tela: 'briefing', quando: () => CEN && CEN.id === 1, titulo: '🎯 Antes de começar',
      texto: 'Aqui você vê a história, o OBJETIVO (derrotar todos os inimigos), quantas etapas o cenário tem (salas separadas por portas) e a DIFICULDADE. O nível do cenário cresce com o seu nível. Para aprender, Fácil é perfeito. Toque em Começar.',
      destaque: '.caixa-obj', esperar: () => feito('iniciou1') },
    { id: 'b_mapa', tela: 'batalha', quando: () => naBatalha(1), titulo: '🗺️ O campo de batalha',
      texto: 'Isto é um mapa em 3D feito de hexágonos. Arraste com 1 dedo para mover a câmera. Com 2 dedos: afaste/aproxime para dar zoom e gire para mudar o ângulo. Os botões ＋ − ↻ fazem o mesmo, e 🎯 volta para o seu herói.',
      destaque: '.mapa-botoes', botao: 'Entendi' },
    { id: 'b_objetivo', tela: 'batalha', quando: () => naBatalha(1), titulo: '🎯 O objetivo',
      texto: 'Aqui em cima fica sempre o OBJETIVO do cenário e o seu andamento. Neste: derrotar todos os inimigos. Ao cumprir, você vence.',
      destaque: '#obj', botao: 'Entendi' },
    { id: 'b_iniciativa', tela: 'batalha', quando: () => naBatalha(1), titulo: '⚡ Ordem de iniciativa',
      texto: 'Esta faixa lá em cima mostra QUEM JOGA PRIMEIRO. Cada carta tem um número de iniciativa: o menor joga antes. Mas atenção: as cartas dos monstros ficam OCULTAS ("?") até você escolher a sua — não dá para planejar em cima delas! Depois que você joga, elas são reveladas (👣 anda, ⚔️ dano, 🎯 alcance) e a ordem aparece. Toque numa para ver a carta completa e a vida de cada um.',
      destaque: '.ini-faixa', botao: 'Entendi' },
    { id: 'b_escolher', tela: 'batalha', quando: () => naBatalha(1) && T.fase === 'escolha', titulo: '🃏 Escolha a sua carta',
      texto: 'Embaixo estão as SUAS cartas (a mão). Toque numa para marcar e depois em ▶ Jogar. A carta define o que você faz na rodada (andar, atacar, curar...) e o número dourado é a sua iniciativa. Cartas jogadas vão para o descarte. Para recuperá-las, descanse (precisa de 2 cartas usadas): 💤 Descanso longo (iniciativa 99, cura 3 e VOCÊ escolhe a carta usada que se perde) ou ⚡ Descanso rápido (perde uma ao acaso, mas você ainda joga na mesma rodada). Cartas perdidas só voltam no próximo cenário; sem cartas, você desmaia!',
      destaque: '.mao', esperar: () => feito('carta') },
    { id: 'b_mover', tela: 'batalha', quando: () => naBatalha(1) && T.fase === 'heroi', titulo: '👣 Andar',
      texto: () => `Você é o herói da base dourada. Toque num hexágono azul brilhante para andar até lá (a carta diz quantos: ${T.movRest} agora). Pedras e paredes bloqueiam o caminho.`,
      destaque: '.pips', esperar: () => T.heroi.c !== T.saida.c || T.heroi.r !== T.saida.r },

    { id: 'b_atacar', tela: 'batalha', quando: () => naBatalha(1) && T.fase === 'heroi' && !T.acaoUsada && combatentes(T).length > 0, titulo: '⚔️ Atacar',
      texto: 'Chegue perto de um inimigo e toque nele no mapa (ou no botão ⚔️ Atacar aqui embaixo). Os alvos ao alcance ficam com brilho vermelho. O dano é sempre o mesmo número da carta, sem sorte. Você pode andar antes e depois de atacar.',
      destaque: '[data-a=tat-atacar]', esperar: () => T.acaoUsada || T.rodada > 1 },
    { id: 'b_modcarta', tela: 'batalha', quando: () => naBatalha(1) && T.log.some(l => l.msg.startsWith('🎴 Carta do seu ataque')), titulo: '🎴 A carta da sorte',
      texto: 'Cada ataque vira UMA carta do baralho, sozinha (você viu ela aparecer no mapa): +N soma dano, −N tira, ×2 dobra e ✖ faz o ataque falhar. Os monstros também têm o baralho deles. O baralho só é embaralhado de novo quando sai ×2 ou ✖. Toque em 🎴 (embaixo) ou 📋 para ver as cartas.',
      destaque: '.baralho-tag', botao: 'Entendi' },
    { id: 'b_fimturno', tela: 'batalha', quando: () => naBatalha(1) && T.fase === 'heroi' && (T.acaoUsada || T.movRest === 0), titulo: '⏭️ Encerrar o turno',
      texto: 'Terminou de andar e atacar? Toque em Encerrar. Os inimigos que ainda não jogaram agem, cada um com a carta dele. (Se não sobrar nada para fazer, o turno acaba sozinho.)',
      destaque: '[data-a=tat-fim]', esperar: () => T.rodada > 1 || !!T.fim },
    { id: 'b_vida', tela: 'batalha', quando: () => naBatalha(1) && T.rodada >= 2, titulo: '❤️ Vida e itens',
      texto: 'Fique de olho na sua vida ❤️ (o máximo do jogo é 30). Se chegar a zero você cai e perde um pouco de ouro. Os itens da 🎒 Mochila NÃO gastam a sua jogada: use uma poção quando precisar. E se a mão estiver acabando, jogue 💤 Descansar.',
      destaque: '.hud-heroi', botao: 'Entendi' },
    { id: 'b_armadilha', tela: 'batalha', quando: () => naBatalha(1) && T.rodada >= 2 && T.armadilhas.size > 0, titulo: '⚠️ Armadilhas',
      texto: 'Os símbolos no chão são armadilhas do cenário. Quem pisa dispara: você OU os inimigos. Se o seu caminho passar por uma, o jogo avisa e pede um segundo toque. Dica: empurre os monstros para dentro delas! (O ícone ficou na faixa do topo; o 📋 explica.)',
      destaque: '.chip-arm', botao: 'Entendi' },
    { id: 'b_moedas', tela: 'batalha', quando: () => naBatalha(1) && T.moedas.size > 0, titulo: '🪙 Moedas',
      texto: 'Todo monstro derrotado solta moedas no chão. Para pegar, termine o seu movimento em cima. Elas viram ouro só no FIM do cenário: cada moeda vale 2 de ouro (3 a partir do cenário 11). O ouro compra itens com o mercador.',
      destaque: '.pips', esperar: () => T.moedas.size === 0 || T.livre || !!T.fim },
    { id: 'b_salalimpa', tela: 'batalha', quando: () => cen() === 1 && T.limpa && !T.ultimaEtapa && !T.fim, titulo: '🚪 Sala limpa!',
      texto: 'Você limpou a sala! Mas a porta NÃO abre sozinha: ela só abre quando você CHEGAR nela, usando as suas cartas (a rodada continua, só que sem monstros). Antes, pegue as moedas do chão: o que ficar para trás se perde!',
      destaque: '#obj', botao: 'Entendi' },
    { id: 'b_porta', tela: 'batalha', quando: () => cen() === 1 && T.limpa && !T.ultimaEtapa && !!T.porta && !T.fim, titulo: '🚪 Rumo à porta',
      texto: 'Escolha uma carta com movimento e ande até o hexágono da porta (ele brilha como os outros hexágonos azuis). Se a porta estiver longe, vá em mais de uma rodada. Quando você chegar nela, ela se abre.',
      destaque: '#obj', esperar: () => !T || T.fim === 'porta' || cen() !== 1 || T.ultimaEtapa },
    { id: 'b_ultima', tela: 'batalha', quando: () => naBatalha(1) && T.ultimaEtapa, titulo: '🏁 Última sala',
      texto: 'Esta é a última etapa: não tem porta. Cumpra o objetivo (derrotar todos, por exemplo) e depois VOLTE À ENTRADA 🚪 com as suas cartas para concluir o cenário. O baú e as moedas precisam ser pegos antes: o que ficar para trás se perde!',
      destaque: '#obj', botao: 'Entendi' },
    { id: 'b_vitoria1', tela: 'batalha', quando: () => cen() === 1 && T.fim === 'vitoria' && T.ultimaEtapa, titulo: '🏆 Objetivo cumprido!',
      texto: 'Você voltou à saída e venceu! As moedas que você carregava viram ouro agora. Toque em Concluir cenário: você ganha também uma recompensa aleatória (ouro, XP ou um item).',
      destaque: '.fim', botao: 'Entendi' },

    /* ---------- depois do cenário 1: loja, inventário, atributos ---------- */
    { id: 'r_loja', tela: 'reino', quando: () => !!P.cenarios[1], titulo: '🛒 Hora de gastar as moedas',
      texto: 'Muito bem! As moedas compram equipamentos e poções. Cada reino tem um mercador. Toque em 🛒 para visitar o de Valhala.',
      destaque: '[data-a=loja]', esperar: () => feito('loja') },
    { id: 'l_loja', tela: 'loja', titulo: '🛒 O mercador',
      texto: 'Seu ouro 🪙 aparece no topo. Na aba Comprar, a seta ▲ verde mostra quanto o item é MELHOR que o que você usa (▼ é pior). Na aba Vender, você troca itens sobrando por 40% do preço. Compre alguma coisa!',
      destaque: '.abas', esperar: () => feito('comprou') },
    { id: 'l_voltar', tela: 'loja', quando: () => ok('l_loja'), titulo: '✅ Compra feita',
      texto: 'Poções ficam no inventário para usar na batalha. Cada parte do corpo aceita 1 item (cabeça, peito, pés) e as mãos aceitam 2. Equipamentos precisam ser EQUIPADOS (veja no inventário). Toque em Sair da loja.',
      destaque: '[data-a=voltar-reino]', esperar: () => feito('saiuloja') },
    { id: 'r_inv', tela: 'reino', quando: () => ok('r_loja') && ok('l_loja'), titulo: '🎒 Inventário',
      texto: 'Abra o Inventário: equipamentos da mochila têm o botão Equipar; poções podem ser usadas aqui ou na batalha. (Para ver o que está equipado, use 🧙 Personagem.)',
      destaque: '.rodape [data-a=inventario]', esperar: () => feito('inventario') },
    { id: 'r_pontos', tela: 'reino', quando: () => ok('r_inv') && P.pontos > 0, titulo: '✨ Pontos de atributo',
      texto: 'Você subiu de nível e ganhou pontos! Em 🧙 Personagem, distribua: cada atributo dá um bônus a cada poucos pontos (FOR/DES/INT = dano conforme a classe, VIT = vida). Vale gastar sempre que tiver pontos.',
      destaque: '.rodape [data-a=personagem]', esperar: () => feito('personagem') || P.pontos === 0 },
    { id: 'r_baralho', tela: 'reino', quando: () => ok('r_inv') && (ok('r_pontos') || P.pontos === 0), titulo: '🏅 Conquistas e baralho',
      texto: 'Em 🧙 Personagem você vê o seu baralho de ataque e as CONQUISTAS (100 XP, 50 moedas, abrir baús, derrotar chefes...). Cada conquista coloca uma carta melhor no baralho (máximo de 15 cartas: a nova troca a pior). Os mercadores também liberam equipamentos melhores a cada 5 cenários concluídos.',
      destaque: '.rodape [data-a=personagem]', botao: 'Entendi' },
    { id: 'r_cen2', tela: 'reino', quando: () => !!P.cenarios[1] && !P.cenarios[2] && ok('r_inv'), titulo: '📜 Próximo cenário',
      texto: 'Agora o cenário 2, "O Tesouro de Brokkr", com um objetivo diferente. Toque nele.',
      destaque: '[data-a=cenario][data-id="2"]', esperar: () => feito('cenario2') },

    /* ---------- cenário 2: baú + habilidades ---------- */
    { id: 'br2', tela: 'briefing', quando: () => CEN && CEN.id === 2, titulo: '🧰 Objetivo: o baú',
      texto: 'Aqui você NÃO precisa matar todo mundo: basta abrir o baú do tesouro, na última sala. Mas as salas anteriores ainda precisam ser limpas para abrir as portas. Toque em Começar.',
      destaque: '.caixa-obj', esperar: () => feito('iniciou2') },
    { id: 'b2_cartas', tela: 'batalha', quando: () => naBatalha(2) && T.fase === 'escolha', titulo: '💨 Empurrar e puxar',
      texto: 'Algumas cartas EMPURRAM (💨) ou PUXAM (🧲) o alvo. Empurrar joga o inimigo para longe; puxar traz até você. Se ele bater numa parede ou em outro monstro, para; se cair numa armadilha, ela dispara nele! Chefes e estruturas resistem. Olhe a mão e escolha uma carta assim.',
      destaque: '.mao', botao: 'Entendi' },

    { id: 'b2_itens', tela: 'batalha', quando: () => naBatalha(2) && T.fase === 'heroi' && T.rodada >= 2, titulo: '🎒 Itens são livres',
      texto: 'Toque em 🎒 Mochila para usar uma poção ou item: isso NÃO conta como a sua jogada, é um complemento. Só cabem os itens que a mochila aguenta (2 no começo, até 5 nos níveis altos). Escudo vem das cartas e dos equipamentos.',
      destaque: '[data-a=tat-itens]', botao: 'Entendi' },
    { id: 'b2_bau', tela: 'batalha', quando: () => naBatalha(2) && T.ultimaEtapa && !!T.bau && !T.bau.aberto,
      aoMostrar: () => { try { Cena3D.centralizar(T.bau.c, T.bau.r); } catch (e) { /* sem câmera */ } },
      titulo: '🧰 O baú do tesouro',
      texto: 'O baú está brilhando no mapa (a câmera foi até ele). Para abrir, ande até o hexágono dele e termine o turno ali PARADO. Neste cenário isso cumpre o objetivo (você pode ignorar os monstros, mas eles atacam enquanto você corre!). Depois ainda precisa voltar à entrada para concluir.',
      destaque: '#obj', botao: 'Entendi' },
    { id: 'b2_bau_pisou', tela: 'batalha', quando: () => naBatalha(2) && !!T.bau && !T.bau.aberto && T.heroi.c === T.bau.c && T.heroi.r === T.bau.r, titulo: '🧰 Você está no baú!',
      texto: 'Perfeito! Agora toque em Encerrar turno para abrir o baú.',
      destaque: '[data-a=tat-fim]', esperar: () => !!(T.bau && T.bau.aberto) },
    { id: 'b2_volta', tela: 'batalha', quando: () => cen() === 2 && T.limpa && T.ultimaEtapa && !T.fim, titulo: '🚪 Agora, de volta à saída',
      texto: 'Baú aberto, objetivo cumprido! Para CONCLUIR o cenário você precisa voltar ao hexágono onde começou (a entrada 🚪), usando as cartas. Os monstros já recuaram.',
      destaque: '#obj', botao: 'Entendi' },
    { id: 'b2_vitoria', tela: 'batalha', quando: () => cen() === 2 && T.fim === 'vitoria', titulo: '🎁 Baú aberto!',
      texto: 'O baú deu ouro e itens, e o objetivo foi cumprido. Toque em Concluir cenário para receber também a recompensa aleatória do cenário.',
      destaque: '.fim', botao: 'Entendi' },
    { id: 'r_cen3', tela: 'reino', quando: () => !!P.cenarios[2] && !P.cenarios[3], titulo: '📜 Cenário 3',
      texto: 'Muito bem! Agora o cenário 3, "As Torres de Gelo". Dica: se estiver com pouca vida, use 🏕️ Acampar para recuperar tudo (custa ouro). Toque no cenário 3.',
      destaque: '[data-a=cenario][data-id="3"]', esperar: () => feito('cenario3') },

    /* ---------- cenário 3: destruir estruturas ---------- */
    { id: 'br3', tela: 'briefing', quando: () => CEN && CEN.id === 3, titulo: '🏗️ Objetivo: destruir',
      texto: 'Aqui o objetivo é DESTRUIR as estruturas (torres de gelo) da última sala. Elas não andam nem atacam, mas têm muita vida. Você também pode trocar a dificuldade a qualquer momento. Toque em Começar.',
      destaque: '.caixa-obj', esperar: () => feito('iniciou3') },
    { id: 'b3_estrutura', tela: 'batalha', quando: () => naBatalha(3) && T.ultimaEtapa && T.inim.some(e => e.vivo && e.estrutura),
      aoMostrar: () => { try { const e = T.inim.find(x => x.vivo && x.estrutura); Cena3D.centralizar(e.c, e.r); } catch (e) { /* sem câmera */ } },
      titulo: '🏗️ Estruturas',
      texto: 'As torres são ESTRUTURAS: aparecem na faixa do topo (e no 📋) e no objetivo (quantas faltam). Ataque-as como a um inimigo. Elas têm bastante defesa, então cartas de dano alto ajudam. Os monstros da sala continuam atacando você!',
      destaque: '#obj', botao: 'Entendi' },
    { id: 'b3_dica', tela: 'batalha', quando: () => naBatalha(3) && T.ultimaEtapa && T.rodada >= 2, titulo: '🧠 Dica de estratégia',
      texto: 'Primeiro cuide dos monstros que machucam você; depois destrua as torres com calma. Use a faixa de iniciativa para prever quem vai atacar, e jogue-os nas armadilhas com empurrar/puxar.',
      destaque: '.ini-faixa', botao: 'Entendi' },
    { id: 'r_fim', tela: 'reino', quando: () => !!P.cenarios[3], titulo: '🎉 Tutorial concluído!',
      texto: 'Você aprendeu o básico: andar, cartas de iniciativa, atacar, objetivos, moedas, baú, loja e estruturas. O próximo é o Covil de Fenrir, com um CHEFE. Compre equipamento, gaste seus pontos e boa sorte! (Para rever o tutorial, use o link no mapa dos reinos.)',
      botao: 'Entendi' },
  ];

  let marcado = [];                    // elementos com destaque piscando
  let atual = null;                    // id do passo mostrado agora

  const ativo = () => !!(P && P.tutorial && !P.tutorial.off);
  const guardar = () => { try { salvar(); } catch (e) { /* ok */ } };
  const texto = p => (typeof p.texto === 'function' ? p.texto() : p.texto);

  function limpar() {
    const c = document.getElementById('tut'); if (c) c.remove();
    marcado.forEach(el => el.classList.remove('tut-alvo')); marcado = [];
    atual = null;
  }

  /** Mostra (ou atualiza) o cartão do passo certo para a tela atual. Chamada pelo ui.js depois de desenhar a tela. */
  function deduzir() {
    if (document.querySelector('#app .tela.tatica')) return 'batalha';
    if (document.querySelector('#app .tela.loja')) return 'loja';
    if (document.querySelector('#app .tela .cen-topo')) return 'briefing';
    if (document.querySelector('#app .tela.mapa')) return 'mapa';
    if (document.querySelector('#app .tela.reino')) return 'reino';
    return null;
  }
  function checar(tela) {
    tela = tela || deduzir();
    if (typeof P === 'undefined' || !P || !P.tutorial) return;
    if (!ativo()) { limpar(); return; }
    const feitos = P.tutorial.feitos;
    let passo = null, mudou = false;
    // o passo que estava na tela: se a ação dele aconteceu, ou o jogador seguiu para outra tela, ele está concluído
    const anterior = atual && PASSOS.find(p => p.id === atual);
    if (anterior && !feitos[anterior.id] && ((anterior.esperar && safe(anterior.esperar)) || anterior.tela !== tela)) { feitos[anterior.id] = true; mudou = true; }
    for (let guard = 0; guard < 30; guard++) {
      passo = PASSOS.find(p => p.tela === tela && !feitos[p.id] && (!p.quando || safe(p.quando)));
      if (!passo) break;
      if (passo.esperar && safe(passo.esperar)) { feitos[passo.id] = true; mudou = true; continue; }   // já feito antes de ver o cartão
      break;
    }
    if (mudou) guardar();
    if (!passo) { limpar(); return; }
    const tela$ = document.querySelector('#app .palco') || document.querySelector('#app .tela');
    if (!tela$) return;
    let cartao = document.getElementById('tut');
    const novo = atual !== passo.id || !cartao || !tela$.contains(cartao);
    if (novo) {
      limpar();
      atual = passo.id;
      const n = PASSOS.filter(p => feitos[p.id]).length + 1;
      cartao = document.createElement('div'); cartao.id = 'tut'; cartao.className = 'tut'; cartao.dataset.passo = passo.id;
      cartao.innerHTML = `<div class="tut-cab"><span>🎓 Tutorial · ${n}/${PASSOS.length}</span><button class="tut-x" data-a="tut-pular" aria-label="Pular o tutorial">Pular tutorial ✕</button></div>
        <b class="tut-titulo">${passo.titulo}</b><p class="tut-texto">${texto(passo)}</p>
        <div class="tut-bts">${passo.esperar
          ? '<span class="tut-espera">👆 Faça a ação para continuar</span><button class="btn link peq" data-a="tut-passo">Pular passo</button>'
          : `<button class="btn" data-a="tut-ok">${passo.botao || 'Entendi'}</button>`}</div>`;
      tela$.insertBefore(cartao, tela$.firstChild);
      if (passo.aoMostrar) safe(passo.aoMostrar);
    } else {
      const t = cartao.querySelector('.tut-texto'); const novoTxt = texto(passo); if (t && t.innerHTML !== novoTxt) t.innerHTML = novoTxt;
    }
    // destaque piscando (o conteúdo da tela é redesenhado, então refaz sempre)
    marcado.forEach(el => el.classList.remove('tut-alvo')); marcado = [];
    if (passo.destaque) document.querySelectorAll(passo.destaque).forEach(el => { if (!el.closest('#tut')) { el.classList.add('tut-alvo'); marcado.push(el); } });
  }
  function safe(f) { try { return f(); } catch (e) { return false; } }

  /** O jogador fez algo que o tutorial acompanha (ex.: 'loja', 'comprou', 'habilidade'). */
  function evento(nome) {
    if (!P || !P.tutorial) return;
    if (!P.tutorial.feitos['ev_' + nome]) { P.tutorial.feitos['ev_' + nome] = true; }
  }
  function concluirAtual() {
    const id = atual; if (!id) return;
    P.tutorial.feitos[id] = true; guardar(); limpar();
  }
  function pular() { if (P && P.tutorial) { P.tutorial.off = true; guardar(); } limpar(); }
  function reiniciar() { P.tutorial = { off: false, feitos: {} }; guardar(); }

  return { checar, evento, concluirAtual, pular, reiniciar, ativo, passos: () => PASSOS.map(p => p.id), limpar };
})();
