'use strict';
/* =====================================================================
   FIO DO DESTINO — EVENTOS DE ESCOLHA, VARIANTES DE CENA E FINAIS
   Flags de enredo:
     munin  = confiança em Munin (cautela, honra, ouvir o corvo mudo)
     hugin  = confiança em Hugin (a via rápida e sombria)
     pacto  = poder aceito do Caos
   efeitos aceitos: ouro, vida, xp, carta ('+1','+2','+3','x2'), item,
                    flags {…}, proximoCenario { vidaInicial | armadilhas | inimigosExtra }
   ===================================================================== */

const EVENTOS = [
  /* ---------------- VALHALA ---------------- */
  {
    id: 'ev_einherjar', depoisDe: 1, icone: '🪓',
    titulo: 'O Guerreiro de Gelo',
    texto: 'Entre as ruínas do salão, um einherjar meio congelado ainda respira, preso até a cintura num bloco de gelo. Hugin pousa no seu ombro: "Pega o amuleto dele e vamos, os mortos não precisam de ouro." Munin, mudo, bica o gelo, como quem pede que você o quebre.',
    opcoes: [
      {
        rotulo: 'Quebrar o gelo e ajudá-lo',
        resultado: 'O guerreiro tosse, ri e jura pela barba de Odin que não esquecerá a dívida. Ele cambaleia para longe, deixando uma poção como pagamento. Munin esfrega a cabeça na sua mão, pela primeira vez.',
        efeitos: { vida: -1, item: 'pocao', flags: { munin: 1, aliado_einherjar: true } },
      },
      {
        rotulo: 'Pegar o amuleto, como Hugin sugeriu',
        resultado: 'O amuleto é pesado e quente, e vale uma boa quantia. O guerreiro te olha, sem forças, até se calar. Hugin parece satisfeito demais. Munin vira o rosto.',
        efeitos: { ouro: 8, flags: { hugin: 1 } },
      },
      {
        rotulo: 'Seguir adiante, sem se envolver',
        resultado: 'Você respeita o silêncio dos mortos e segue em frente. Nem o gelo, nem a consciência pesam mais do que já pesavam.',
        efeitos: { xp: 2 },
      },
    ],
  },
  {
    id: 'ev_runa', depoisDe: 3, icone: 'ᚱ',
    titulo: 'A Runa Sussurrante',
    texto: 'Uma pedra rúnica brilha numa clareira de neve, e a Marca no seu pulso responde com um formigamento. A runa sussurra, numa voz que parece a sua: "Dá-me uma gota de força e eu te devolvo uma vida inteira de sorte." Hugin murmura: "Aceita. É assim que se vence depressa."',
    opcoes: [
      {
        rotulo: 'Oferecer uma gota de sangue',
        resultado: 'A runa bebe o sangue e se acende, rubra. Uma sensação de poder emprestado percorre o braço, e junto vem uma fome estranha. Algo, bem fundo, anotou o seu nome.',
        efeitos: { vida: -2, carta: '+2', flags: { pacto: 1, hugin: 1 } },
      },
      {
        rotulo: 'Ler a inscrição antes de tocar',
        resultado: 'Com paciência, você decifra as linhas: era um aviso, não uma promessa. Ao ler em voz alta, a runa se aquieta e entrega um tônico, como quem aprova a leitura. Munin balança a cabeça, devagar.',
        efeitos: { item: 'tonico_veloz', flags: { munin: 1 } },
      },
      {
        rotulo: 'Quebrar a pedra com o punho',
        resultado: 'A pedra se parte com um estalo e uma rajada de frio. Você sai com os dedos doídos e uma moeda de prata caída dos destroços.',
        efeitos: { vida: -1, ouro: 4, xp: 3 },
      },
    ],
  },

  /* ---------------- OLIMPO ---------------- */
  {
    id: 'ev_oraculo', depoisDe: 5, icone: '🔮',
    titulo: 'A Pítia Sem Língua',
    texto: 'Num templo coberto de nuvens, uma sacerdotisa de olhos vendados estende a mão. Dizem que a Pítia perdeu a voz quando o Olimpo foi trancado. Munin pousa no altar, encara-a e ela sorri, como se ouvisse um velho conhecido. Lembre-se: Munin falou em Ares, e Hugin não gostou.',
    opcoes: [
      {
        rotulo: 'Deixar Munin "conversar" com ela',
        resultado: 'Os dois ficam em silêncio por um longo minuto. Depois a Pítia desenha na areia um corvo de olhos dourados cercado de estrelas, e uma segunda figura, pequena, de pé diante dele. Ela lhe entrega um frasco de antídoto, com uma reverência.',
        efeitos: { item: 'antidoto', xp: 4, flags: { munin: 1 } },
      },
      {
        rotulo: 'Perguntar a Hugin o que ela quis dizer',
        resultado: 'Hugin se irrita com a pergunta, mas ri e inventa uma resposta elegante demais para ser verdade. Em troca da "lealdade", ele aponta uma passagem secreta e uma bolsa esquecida. Você tem a impressão de ter sido guiado, e não informado.',
        efeitos: { ouro: 9, flags: { hugin: 1 } },
      },
      {
        rotulo: 'Pagar por uma profecia clara',
        resultado: 'A Pítia aceita as moedas e escreve em pó dourado: "Cuidado com quem te dá pressa." Você guarda a frase. Ela pode servir a qualquer um, mas por que será que a mão dela tremeu?',
        efeitos: { ouro: -6, xp: 6 },
      },
    ],
  },
  {
    id: 'ev_pegasus', depoisDe: 6, icone: '🐴',
    titulo: 'O Cavalo Alado Ferido',
    texto: 'Um pégaso se arrasta pelo jardim com uma asa presa em ferragens. Hugin comenta com desdém: "Cavalos feridos morrem rápido e atrasam a viagem. Há um atalho pelo Olimpo, mas é guardado por sombras." Munin já está tentando soltar o primeiro parafuso, com o bico.',
    opcoes: [
      {
        rotulo: 'Libertar o pégaso e tratar a asa',
        resultado: 'Leva tempo e cuidado, mas a asa se solta. O pégaso relincha, bate as penas e te cobre com a luz de uma pluma. Ele não pode te levar adiante, mas deixa um presente no chão.',
        efeitos: { ouro: -3, item: 'hidromel', flags: { munin: 1 } },
      },
      {
        rotulo: 'Pegar o atalho que Hugin indicou',
        resultado: 'O atalho é rápido e escuro. Sombras tocam seus ombros, e uma delas sussurra "obrigado" antes de sumir. Você chega adiante cheio de pressa e de ecos.',
        efeitos: { xp: 8, flags: { hugin: 1 }, proximoCenario: { inimigosExtra: 1 } },
      },
      {
        rotulo: 'Dar um fim rápido ao sofrimento dele',
        resultado: 'Você o poupa da dor, mas as penas do pégaso viram pó dourado em suas mãos. Munin não olha para você durante o resto do dia.',
        efeitos: { ouro: 5, flags: { munin: -1 } },
      },
    ],
  },
  {
    id: 'ev_banquete', depoisDe: 7, icone: '🍇',
    titulo: 'O Banquete Dos Deuses Adormecidos',
    texto: 'Uma mesa imensa se estende entre colunas: frutas que brilham, vinho que nunca acaba, tudo intacto desde que o Olimpo foi trancado. Ares ordenou impedir quem junte os Fragmentos, mas nada aqui parece vigiar. Uma taça sussurra seu nome com a voz de Hugin.',
    opcoes: [
      {
        rotulo: 'Comer e beber à vontade',
        resultado: 'Você se sente forte, tão forte que a Marca para de arder. Quando o torpor passa, percebe que ela parou de arder porque algo está cobrindo sua dor. Mas por ora, o corpo agradece.',
        efeitos: { vida: 5, flags: { pacto: 1 }, proximoCenario: { vidaInicial: -2 } },
      },
      {
        rotulo: 'Levar só o que cabe na mochila',
        resultado: 'Você escolhe uma ambrosia pequena e coloca uma moeda de ouro sobre a mesa, por cortesia. Em algum lugar, uma deusa adormecida sorri sem acordar.',
        efeitos: { ouro: -2, item: 'ambrosia', flags: { munin: 1 } },
      },
      {
        rotulo: 'Esvaziar os pratos de ouro para vender',
        resultado: 'Os pratos tilintam alto demais. Você sai com os bolsos pesados e a sensação de que alguém, em sonhos, tomou nota do furto.',
        efeitos: { ouro: 12, proximoCenario: { armadilhas: 1 } },
      },
    ],
  },

  /* ---------------- INFERNO ---------------- */
  {
    id: 'ev_barqueiro', depoisDe: 9, icone: '🛶',
    titulo: 'A Dívida de Caronte',
    texto: 'Uma barca atravessa o Flegetonte sem remador. Uma voz rouca diz: "A travessia custa uma lembrança, mortal. Pode ser a mais feliz ou a mais amarga. O Inferno não se importa qual." Munin já avisou em Olimpo que Hugin não é Hugin. Agora você se pergunta o que mais a sua memória esconde.',
    opcoes: [
      {
        rotulo: 'Pagar com uma lembrança feliz',
        resultado: 'Você entrega uma tarde de infância e o barqueiro engole o riso. A travessia é suave. Você esquece o gosto exato do bolo da sua avó, e uma pequena tristeza vira companheira.',
        efeitos: { vida: 3, xp: 6, flags: { munin: 1 } },
      },
      {
        rotulo: 'Pagar com uma lembrança amarga',
        resultado: 'O barqueiro prova a dor e faz uma careta de aprovação. Você se sente mais leve, menos sensível ao que dói. Em algum lugar, Hugin sorri: "Viu? Esquecer é uma ferramenta."',
        efeitos: { ouro: 6, xp: 4, flags: { hugin: 1, pacto: 1 } },
      },
      {
        rotulo: 'Nadar pelo rio de fogo',
        resultado: 'A travessia queima. Você chega do outro lado chamuscado, com orgulho e sem dívidas. Pelo menos agora as suas lembranças continuam todas suas.',
        efeitos: { vida: -3, xp: 8 },
      },
    ],
  },
  {
    id: 'ev_condenado', depoisDe: 10, icone: '⛓️',
    titulo: 'O Condenado Que Sabe Demais',
    texto: 'Um velho acorrentado ao paredão da fortaleza de Dite grita seu nome. "Tecelão! Eu fui escriba de Hades e vi quem trancou o Olimpo: um corvo com olhos que não refletem luz. Solta-me e eu te conto como atravessar o trono sem lutar." Hugin sibila: "Mentiroso. Ele diria qualquer coisa."',
    opcoes: [
      {
        rotulo: 'Soltá-lo e ouvir',
        resultado: 'Ele chora de alívio e entrega um mapa rabiscado de passagens de Dite. Mas as correntes soltas fazem barulho, e demônios acordam por perto.',
        efeitos: { item: 'pele_pedra', xp: 5, flags: { munin: 1 }, proximoCenario: { inimigosExtra: 1 } },
      },
      {
        rotulo: 'Deixá-lo preso, como Hugin diz',
        resultado: 'Você segue em frente com o velho gritando as últimas palavras às suas costas: "Ele sabe o seu nome verdadeiro!" Hugin ri baixinho. Ele parece menos incomodado do que deveria.',
        efeitos: { ouro: 7, flags: { hugin: 1 } },
      },
      {
        rotulo: 'Barganhar: informação por ouro',
        resultado: 'Ele aceita as moedas e conta metade do que sabe. É um começo, e uma advertência: "Não aceite presentes de quem não tem rosto."',
        efeitos: { ouro: -5, xp: 8 },
      },
    ],
  },
  {
    id: 'ev_cerbero', depoisDe: 11, icone: '🐕‍🦺',
    titulo: 'Os Três Focinhos de Cérbero',
    texto: 'Um filhote de Cérbero, três cabecinhas, uma cauda enorme, brinca com um osso diante do portão de Hades. Ele late três vezes de modo diferente: uma alegre, uma assustada e uma terrivelmente sincera. Hades era apenas guardião de uma porta, e agora o filhote guarda o corredor. Uma voz fria sugere: "Use-o. Cães do Inferno obedecem a quem tem poder."',
    opcoes: [
      {
        rotulo: 'Alimentá-lo e fazer amizade',
        resultado: 'As três cabeças brigam pelo último pedaço e depois se aninham no seu pé. Ele guia você por uma passagem sem armadilhas e se despede com uma lambida tripla.',
        efeitos: { ouro: -2, vida: 2, flags: { munin: 1 } },
      },
      {
        rotulo: 'Dominá-lo com a Marca',
        resultado: 'A Marca brilha e o filhote se curva, trêmulo. Ele obedece e o caminho se abre, mas as três cabeças te olham com um medo que dói. Você ganha poder e um pequeno sabor amargo.',
        efeitos: { carta: '+3', flags: { pacto: 1, hugin: 1 }, proximoCenario: { vidaInicial: -1 } },
      },
      {
        rotulo: 'Contornar o corredor em silêncio',
        resultado: 'Você passa de ponta de pé, com o coração batendo forte. O filhote boceja, sem notar. Ninguém te agradece, mas ninguém te persegue.',
        efeitos: { xp: 6, ouro: 3 },
      },
    ],
  },

  /* ---------------- DUAT ---------------- */
  {
    id: 'ev_balanca', depoisDe: 13, icone: '⚖️',
    titulo: 'A Balança de Maat Torta',
    texto: 'No salão de Osíris, a Balança pende torta: um prato carrega uma pena, o outro, um coração. Uma voz de chacal pergunta: "Teu coração é mais leve do que uma pena, Tecelão?" Você sabe que Hugin era o Caos: cada conselho dele até aqui estava na balança, e agora você vai pesar cada um.',
    opcoes: [
      {
        rotulo: 'Pôr o coração na balança com honestidade',
        resultado: 'O prato oscila, treme e... equilibra. A pena brilha e o salão se aquece. Os juízes baixam as lanças. "Honra tem peso", diz o chacal, e te entrega uma bênção.',
        efeitos: { vida: 4, xp: 10, flags: { munin: 1 } },
      },
      {
        rotulo: 'Inclinar a balança com um truque',
        resultado: 'Você desliza uma moeda de ouro sob o prato e o coração parece leve. Os juízes fingem não ver, mas a Balança passa a pender para o lado errado a cada passo seguinte.',
        efeitos: { ouro: 10, flags: { hugin: 1 }, proximoCenario: { armadilhas: 1 } },
      },
      {
        rotulo: 'Aceitar o "peso" que o Caos oferece',
        resultado: 'Uma voz sem origem sopra: "Deixa que eu carrego o que te pesa." A Balança se acalma, a carga some e, com ela, parte de você. A força cresce, e o silêncio também.',
        efeitos: { carta: 'x2', vida: -2, flags: { pacto: 2 } },
      },
    ],
  },
  {
    id: 'ev_escriba', depoisDe: 14, icone: '📜',
    titulo: 'O Escriba Que Reescreve',
    texto: 'Sob a sombra de uma pirâmide, um escriba de papiro apaga e reescreve glifos numa parede, e a cada glifo trocado a areia ao redor muda de forma. "Posso reescrever uma de suas cicatrizes ou uma de suas dívidas", diz ele. "Mas tudo o que reescrevo pergunta quem era o autor antes." Munin, ferido desde Set, pousa perto de você.',
    opcoes: [
      {
        rotulo: 'Reescrever uma cicatriz',
        resultado: 'A cicatriz some e o corpo ganha fôlego. Mas você já não lembra de onde veio a marca, e uma parte da sua história virou rascunho.',
        efeitos: { vida: 5, flags: { pacto: 1 } },
      },
      {
        rotulo: 'Perguntar a Munin o que fazer',
        resultado: 'Munin, ainda fraco, bica um glifo específico. O escriba sorri e o apaga com cuidado: era um glifo de Set, preso à Marca. O peso no pulso alivia, e Munin ergue o bico, quase orgulhoso.',
        efeitos: { xp: 8, item: 'antidoto', flags: { munin: 2 } },
      },
      {
        rotulo: 'Pedir que apague uma dívida de ouro',
        resultado: 'O escriba risca a dívida e a areia ao redor muda de cor. Você sai mais rico e um pouco desconfiado. Quem escreve dívidas também sabe cobrá-las.',
        efeitos: { ouro: 10, proximoCenario: { inimigosExtra: 1 } },
      },
    ],
  },
  {
    id: 'ev_eco_hugin', depoisDe: 15, icone: '🐦‍⬛',
    titulo: 'O Eco de Hugin',
    texto: 'Entre as dunas, uma pena negra flutua sozinha e se transforma, na sua mão, na voz do falso Hugin: "Ainda estás aí, Tecelão? Eu nunca menti sobre a pressa. O caminho curto é mesmo o único que chega ao Abismo antes que o Fio apodreça." Munin tosse e encara a pena com raiva silenciosa.',
    opcoes: [
      {
        rotulo: 'Queimar a pena',
        resultado: 'A pena grita e vira fumaça. O vento leva a voz embora, e Munin pousa no seu ombro, mais leve. Você perde um atalho, mas ganha a certeza de estar no caminho certo.',
        efeitos: { xp: 8, vida: 1, flags: { munin: 1 } },
      },
      {
        rotulo: 'Ouvir o que o eco tem a dizer',
        resultado: 'A voz conta um segredo verdadeiro sobre uma passagem de Apófis, e dois outros falsos, misturados com talento. Você sai com um atalho, e com a dúvida de qual parte era verdade.',
        efeitos: { ouro: 8, carta: '+2', flags: { hugin: 1 }, proximoCenario: { armadilhas: 1 } },
      },
      {
        rotulo: 'Guardar a pena como lembrança',
        resultado: 'A pena se aquieta, mas passa a pesar no bolso como uma pedra pequena. Dá para ouvir, às vezes, uma risada baixa vindo de dentro.',
        efeitos: { xp: 5, flags: { pacto: 1 } },
      },
    ],
  },

  /* ---------------- ABISMO ---------------- */
  {
    id: 'ev_fio_solto', depoisDe: 18, icone: '🧵',
    titulo: 'O Fio Solto',
    texto: 'No Abismo, um único fio brilhante flutua diante de você, fino como cabelo. Ele vibra com cada coisa que você escolheu até aqui: ouvir Munin, ceder a Hugin, aceitar o Caos. A voz do Primeiro Fio, sem origem, pergunta: "Qual extremidade você segura, Tecelão?"',
    opcoes: [
      {
        rotulo: 'Segurar a ponta que Munin carrega',
        resultado: 'Munin segura o outro lado com o bico e puxa com todas as forças. O fio se acalma e brilha em dourado. Você sente um aperto no peito e uma certeza nova: ninguém tece sozinho.',
        efeitos: { vida: 4, xp: 12, flags: { munin: 1 } },
      },
      {
        rotulo: 'Segurar a ponta que o Caos oferece',
        resultado: 'O fio queima e depois acaricia. A voz sussurra: "Bem-vindo à metade que faltava." Seus punhos ficam mais fortes, e a sombra no chão, mais comprida do que deveria ser.',
        efeitos: { carta: '+3', vida: -3, flags: { pacto: 2 } },
      },
      {
        rotulo: 'Cortar o fio com a própria mão',
        resultado: 'O fio estala e as duas pontas se enrolam sozinhas no seu punho, como se perdoassem. Você ganha um tempo e uma poção, e o Abismo parece fazer silêncio, curioso.',
        efeitos: { item: 'pocao', xp: 8, ouro: 5 },
      },
    ],
  },
];

/* =====================================================================
   VARIANTES DA CENA DE DEPOIS DA LUTA (páginas extras opcionais)
   ===================================================================== */
const VARIANTES_CENA = {
  fenrir: [
    {
      icone: '🐦‍⬛',
      texto: 'Munin pousa na sua mão e, pela primeira vez, não foge do toque. Ele olha para o Fragmento e depois para você, e um brilho antigo cruza os olhos dele. "Cuidar de quem não pode falar é um bom começo", parece dizer. {nome} sorri.',
      se: { flag: 'munin', min: 2 },
    },
    {
      icone: '🐦‍⬛',
      texto: 'Hugin pousa no seu ombro, satisfeito: "Viste? A pressa vale a pena. Os mortos não pesam, e os atalhos nunca machucam." {nome} sente o Fragmento esquentar quando ele fala, como se gostasse da voz.',
      se: { flag: 'hugin', min: 2 },
    },
    {
      icone: '🌑',
      texto: 'Uma sombra fina escorre do Fragmento de Gelo e some na Marca. O pulso de {nome} dói, mas é uma dor conhecida, quase familiar. De dentro dela, alguém sussurra: "Obrigado."',
      se: { flag: 'pacto', min: 1 },
    },
  ],
  ares: [
    {
      icone: '🔱',
      texto: 'Antes que Ares se vá, ele aponta o queixo para Munin: "Esse corvo carregou mais verdade nas penas do que eu em mil batalhas. Não o perca de vista, Tecelão. E lembre-se de que você ouviu antes de lutar, e isso poucos fazem."',
      se: { flag: 'munin', min: 2 },
    },
    {
      icone: '🔱',
      texto: 'Ares olha para você com pena e ironia: "Você veio rápido demais pelos meus corredores, e aceitou ajuda que não devia. Quem corre pelo caminho que outro escolhe nunca vê onde ele termina." Hugin, ao lado, finge não escutar.',
      se: { flag: 'hugin', min: 2 },
    },
    {
      icone: '🔱',
      texto: 'Ares fecha a mão sobre a lança e franze o cenho: "O Fragmento reluz de um jeito estranho em você. Já senti esse brilho antes: é o cheiro de um pacto. Tome cuidado com quem te oferece força sem pedir nada."',
      se: { flag: 'pacto', min: 1 },
    },
    {
      icone: '🐦‍⬛',
      texto: 'Munin tenta falar de novo, mas {nome} está distraído e o corvo recua, sem insistir. Fica um silêncio incômodo, e Ares balança a cabeça: "Ouça os que falam pouco, mortal. Eles costumam falar o que importa."',
      se: { flag: 'munin', max: 0 },
    },
  ],
  hades: [
    {
      icone: '👑',
      texto: 'Hades levanta os olhos para Munin com um respeito cansado: "O Pensamento verdadeiro nunca se esquece de quem confiou nele. Se Munin ainda fala por você, Tecelão, então ainda há um nó de esperança neste mundo."',
      se: { flag: 'munin', min: 2 },
    },
    {
      icone: '🌑',
      texto: 'Hades observa a sombra de {nome} e murmura: "Eu guardo mortos há milênios. Reconheço o cheiro de um acordo mal feito." Hugin o interrompe com uma risada seca, mas o Fragmento de Morte pulsa, inquieto, na mão de {nome}.',
      se: { flag: 'pacto', min: 1 },
    },
    {
      icone: '🐦‍⬛',
      texto: 'Hugin pousa mais perto do que o normal, a voz macia: "Confia em mim, Tecelão. Eu sempre te deixei passar mais rápido do que os outros. Falta pouco, falta só um." {nome} sente um calafrio, mas também uma pontada de gratidão, e isso é pior.',
      se: { flag: 'hugin', min: 2 },
    },
  ],
  set: [
    {
      icone: '🐦‍⬛',
      texto: 'Munin vacila, mas não desaba. "Você me ouviu quando ninguém ouvia", ele murmura, com a voz rouca. "Por isso o Caos não conseguiu te convencer ainda. Segure o Fragmento perto, e o Fio verá que você ainda é você."',
      se: { flag: 'munin', min: 2 },
    },
    {
      icone: '🌌',
      texto: 'O Caos Primordial inclina a cabeça para {nome}, quase carinhoso: "Eu te guiei por atalhos, e você aceitou cada um. Fico lisonjeado, Tecelão. Cada passo foi seu, e cada passo era meu. Pergunte a si mesmo qual dos dois era a verdade."',
      se: { flag: 'hugin', min: 2 },
    },
    {
      icone: '🌌',
      texto: 'A Marca pulsa e uma segunda sombra se desenha atrás de {nome}, com o formato de asas. "Você me aceitou antes de me conhecer", diz o Caos. "É assim que se começam as melhores alianças. A porta já estava aberta, eu só entrei."',
      se: { flag: 'pacto', min: 1 },
    },
    {
      icone: '🐦‍⬛',
      texto: 'Munin tenta consolar {nome}, mas o corvo fala baixo e longe, como alguém que não foi ouvido. "Eu avisei", ele sussurra. "Eu avisei tantas vezes." O Caos ri, e a risada vem de todos os lados.',
      se: { flag: 'munin', max: 0 },
    },
  ],
};

/* =====================================================================
   FINAIS (substituem o epílogo)
   ===================================================================== */
const FINAIS = {
  munin: [
    { icone: '🌌', texto: 'O Caos Primordial se desfaz em fios soltos, mas desta vez não há raiva nele: apenas cansaço. {nome} estende a mão, e o Fio velho, cansado, se enrosca ali, como um gato que finalmente encontrou um colo.' },
    { icone: '🐦‍⬛', texto: 'Munin pousa no pulso marcado e fala, com a voz mais clara que já teve: "Tecer não é mandar, Tecelão. É escutar cada fio antes de puxá-lo." Pela primeira vez em mil anos, o corvo sorri, ou parece sorrir.' },
    { icone: '🧶', texto: 'Juntos, {nome} e Munin tecem o Fio novo. Valhala degela, o Olimpo desperta, o Inferno esfria e o Duat respira. Cada deus recebe um nó, mas todos os nós ficam ligados uns aos outros.' },
    { icone: '🌅', texto: 'Odin, Zeus, Hades e Rá se curvam. Mas {nome} recusa a coroa: "O Fio não é meu. É de todos nós." Munin pousa no ombro dele e as penas do corvo, antes negras, ficam brancas como um novo começo.' },
    { icone: '🔭', texto: 'Fim do primeiro ato. Mas, no extremo do Fio, uma ponta fina e desconhecida vibra. Alguém, em outro mundo, também sabe tecer e está respondendo ao chamado. O Fio do Destino continua.' },
  ],
  pacto: [
    { icone: '🌌', texto: 'O Caos Primordial não se desfaz: se curva, e entra, devagar, na Marca de {nome}. O Abismo inteiro se aquieta. Os Fragmentos giram em torno do pulso, obedientes, como cães de caça que enfim reconheceram o dono.' },
    { icone: '🧶', texto: '{nome} ergue o Fio e ele obedece. Valhala, Olimpo, Inferno e Duat se reconectam. Mas o Fio agora é negro por dentro, e as costuras brilham com uma luz que não pertence a nenhum deus conhecido.' },
    { icone: '🐦‍⬛', texto: 'Munin, ferido, observa de longe. "Você ainda é você?", pergunta, sem esperar resposta. {nome} responde com um sorriso que demora um segundo a mais para chegar. O corvo desvia o olhar e voa para o escuro.' },
    { icone: '👑', texto: 'Odin, Zeus, Hades e Rá acordam e se ajoelham diante de {nome}. Não por respeito, e sim por medo. "O destino agora é seu", dizem, e há um tremor na voz. O Fio já não muda de dono: ele mudou de natureza.' },
    { icone: '🔭', texto: 'Fim do primeiro ato. Mas, nas sombras entre os mundos, alguém sorri com a boca de {nome}, e não é {nome}. O que o Caos aprendeu a tecer, ele ainda não terminou de dizer. O Fio do Destino continua.' },
  ],
  neutro: [
    { icone: '🌌', texto: 'O Caos Primordial se desfaz como névoa ao amanhecer, mas não morre: dobra-se, como um fio velho, e se entrelaça nos Fragmentos. "Obrigado... por me lembrar de como se tece."' },
    { icone: '🧶', texto: '{nome} ergue o Fio. Ele se estende pelos nove mundos: Valhala, Olimpo, Inferno e Duat voltam a se ligar, e os deuses presos acordam, um por um.' },
    { icone: '🐦‍⬛', texto: 'Munin pousa no ombro de {nome}: "Hugin enganou a todos. Menos o Fio. Ele sabia que você não pediria o poder para si." É a última coisa que o corvo diz antes de se desfazer em penas brancas, sem saber ao certo se foi ouvido.' },
    { icone: '🌅', texto: 'Odin, Zeus, Hades e Rá se curvam diante de um mortal. "O destino agora é seu para tecer", dizem. {nome} sorri e deixa, de propósito, um nó solto no fim do Fio.' },
    { icone: '🔭', texto: 'Fim do primeiro ato. Mas além dos nove mundos, alguma coisa percebeu o nó solto... e começou a puxá-lo. Penas, brancas e negras, caem em silêncio sobre o Fio. O Fio do Destino continua.' },
  ],
};

/* ---------- FUNÇÕES ---------- */

/** Escolhe o final conforme as flags de P.flags (flags ausentes = 0). */
function finalDoJogo(flags) {
  const f = flags || {};
  const munin = Number(f.munin) || 0;
  const pacto = Number(f.pacto) || 0;
  if (munin >= 3 && munin > pacto) return FINAIS.munin;
  if (pacto >= 3) return FINAIS.pacto;
  return FINAIS.neutro;
}

/** Devolve paginasBase seguida das páginas extras de VARIANTES_CENA[chefeId] cujo "se" é satisfeito. */
function paginasDaCena(chefeId, paginasBase, flags) {
  const f = flags || {};
  const base = Array.isArray(paginasBase) ? paginasBase : [];
  const extras = (VARIANTES_CENA[chefeId] || []).filter((p) => {
    if (!p.se) return true;
    const v = Number(f[p.se.flag]) || 0;
    if (p.se.min !== undefined && v < p.se.min) return false;
    if (p.se.max !== undefined && v > p.se.max) return false;
    return true;
  });
  return base.concat(extras);
}
