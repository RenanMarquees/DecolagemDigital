# Miniaturas do Fio do Destino

## Como elas são feitas hoje

Cada herói, monstro, chefe e estrutura é um modelo 3D **montado por código** (esferas, tubos, chifres, placas…), com textura de pele/metal/pelo gerada na hora, contorno de "miniatura pintada" e animação (andar, golpear, asas batendo, mandíbula abrindo).

| Arquivo | O que tem |
|---|---|
| `js/modelos3d.js` | a "caixa de ferramentas" (formas, texturas, animação, luz) |
| `js/modelos3d/heroi.js` | Guerreiro, Caçador e Oráculo |
| `js/modelos3d/valhala.js` | Draugr, Lobo de Gelo, Valquíria, Troll de Gelo, Fenrir |
| `js/modelos3d/olimpo.js` | Harpia, Sátiro, Ciclope, Minotauro, Ares |
| `js/modelos3d/inferno.js` | Alma Penada, Diabrete, Cérbero, Demônio, Hades |
| `js/modelos3d/duat.js` | Escaravelho, Múmia, Chacal, Serpente, Set |
| `js/modelos3d/estruturas.js` | torres, altares, portais, estelas, cristais, Caos Primordial |

Para **ver todos de uma vez**: `node tools/folha-miniaturas.js` (gera uma folha de imagens; veja o comentário no topo do arquivo).

## Ainda quer mais detalhe? Use um modelo pronto (.glb)

Código tem limite: o resultado é "esculpido com blocos". Para um visual de miniatura de resina, o caminho é gerar o modelo em um serviço de IA/banco de modelos e **trocar só aquele personagem**, sem mexer no resto.

### Passo a passo

1. Gere ou baixe o modelo em formato **`.glb`** (veja os serviços abaixo).
2. Salve como `modelos/<id>.glb`. O `<id>` é o nome da tabela de baixo (ex.: `modelos/cerbero.glb`).
3. Abra `js/data.js`, ache `MODELOS_GLB` e coloque o id na lista: `const MODELOS_GLB = ['cerbero'];`
4. Recarregue o jogo. O `.glb` **substitui** o modelo de código só desse personagem. Se o arquivo não existir ou falhar, o jogo usa o modelo de código (nada quebra).

Dicas do arquivo: até ~30 mil triângulos (celular!), personagem **de frente para o eixo +Z**, pés no chão (y = 0), altura ~1,6 (o jogo ajusta). Se o modelo já vier com animações chamadas `idle`/`walk`/`attack`, o jogo usa; se não vier, ele só respira.

### Onde conseguir (confira a licença de cada um antes de publicar o jogo)

- **Meshy** (meshy.ai), **Tripo** (tripo3d.ai), **Rodin/Hyper3D**, **Luma Genie**: geram .glb a partir de texto ou de uma imagem. O melhor é mandar uma **foto das suas miniaturas pintadas** (como a que você mandou) como imagem de referência.
- **Sketchfab**, **Quaternius** (grátis), **Kenney** (grátis), **Poly Pizza**: bancos de modelos prontos; filtre por "downloadable" e licença CC0/CC-BY.
- **Mixamo** (mixamo.com): coloca animação de andar/atacar num personagem humanoide.

### Texto (prompt) pronto para cada personagem

Comece sempre com: *"stylized hand-painted fantasy tabletop miniature, 28mm resin figure, highly detailed sculpt, dark fantasy, full body, neutral T-pose or idle stance, plain base, game-ready low poly (under 30k triangles)"* e some:

| id | acrescente |
|---|---|
| `guerreiro` | viking warrior, plate and fur armor, round shield, battle axe |
| `cacador` | hooded ranger, leather armor, longbow, quiver, cloak |
| `oraculo` | robed oracle mage, glowing staff, floating runes, hood |
| `draugr` | undead viking, rusted chainmail, broken horned helmet, frozen beard, cracked shield |
| `lobo_gelo` | giant frost wolf, ice crystal spikes on spine, bared fangs, frozen fur |
| `valquiria` | fallen valkyrie, cracked silver armor, black and white wings, spear, glowing red eyes |
| `troll_gelo` | hunched ice troll, stone and crystal hide, huge arms, tusks, stone club |
| `fenrir` | colossal black wolf, scarred, broken chain collar, huge fangs, red eyes, spikes |
| `harpia` | harpy, bird legs with talons, large feathered wings, emaciated torso, broken shackle |
| `satiro` | furious satyr, spiral ram horns, goat legs, root club, panpipe belt |
| `ciclope` | cyclops giant, single huge eye, scarred chest, bone necklace, boulder club |
| `minotauro` | minotaur, bull head with bronze-banded horns, nose ring, labrys double axe |
| `ares` | Ares god of war, red and bronze armor, crested helmet, serrated glowing sword, spiked shield |
| `alma_penada` | tormented ghost, wispy translucent body, visible ribs, screaming face, chains, blue flames |
| `diabrete` | imp, potbellied, huge ears, toothy grin, trident, fireball in hand |
| `cerbero` | cerberus, three-headed hellhound, spiked collars, exposed ribs, lava cracks, snake tail |
| `demonio` | winged demon, ram horns, bat wings, iron pauldrons, lava veins, flaming sword |
| `hades` | Hades lord of the underworld, tattered cloak, crown of thorns with flames, bident, orbiting souls |
| `escaravelho` | giant scarab beetle, gold and blue carapace, mandibles, Egyptian hieroglyphs |
| `mumia` | cursed mummy, bandages, glowing eyes, ancient jewelry |
| `chacal` | jackal-headed guardian, Egyptian armor, spear, golden collar |
| `serpente` | giant serpent of Apophis, coiled, hood, glowing eyes, dark scales |
| `set` | Set god of chaos, red skin, long snout, was-scepter, ornate gold armor |
| `caos` | primordial chaos entity, swirling void, many eyes, tentacles, purple energy |

## Para quem quer mexer nos modelos de código

- Cada personagem é uma função `Modelos3D.registrar('id', (B, g) => { ... })` no arquivo do reino. Copie um modelo parecido e mude cores, tamanhos e peças.
- Peças que mexem (braço, perna, asa, cauda, mandíbula) são declaradas com `B.pivo`/`balancos`; o resto é fundido numa malha só para ficar leve.
- Orçamento: ~20 mil triângulos por personagem (a folha mostra a contagem).
