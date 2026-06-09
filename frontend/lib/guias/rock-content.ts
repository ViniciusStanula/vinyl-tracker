// Defines display order on the main page — most culturally significant first.
// Unknown slugs sort to the end.
export const SUBGENRE_ORDER: readonly string[] = [
  "classic-rock",
  "hard-rock",
  "progressive-rock",
  "blues-rock",
  "alternative-rock",
  "grunge",
  "psychedelic-rock",
  "folk-rock",
  "indie-rock",
  "new-wave",
  "britpop",
  "glam-rock",
  "garage-rock",
  "southern-rock",
  "shoegaze",
  "post-rock",
  "rockabilly",
  "math-rock",
];

export const ROCK_INTRO = `Analisamos mais de 11.000 discos de rock através da API do Discogs, extraindo a nota e a quantidade de avaliações de cada álbum. A partir desses dados, aplicamos uma média bayesiana ponderada para ranquear os melhores discos de cada subgênero: álbuns com mais avaliações têm mais peso, mas discos menos conhecidos também aparecem quando a qualidade é excepcional.

Por que isso importa pra quem coleciona? Porque a nota do Discogs vem de quem tem o disco na estante, não de crítica profissional. Um álbum com 4,5 de média em milhares de avaliações é um disco que colecionadores do mundo inteiro compraram, ouviram e aprovaram. É o melhor filtro que existe pra decidir qual vinil procurar primeiro.

O resultado está organizado abaixo em 18 subgêneros, do classic rock ao math rock. Clique em qualquer categoria para ver o ranking completo com todos os álbuns analisados, com nota e número de avaliações de cada um.`;


export const SUBGENRE_FULL: Record<string, string> = {
  "alternative-rock": `O rock alternativo nasceu nas margens das rádios universitárias americanas nos anos 1980, onde bandas como R.E.M., The Replacements e Hüsker Dü gravavam para selos independentes e construíam audiências por conta própria. Era um rock deliberadamente fora do circuito mainstream: mais cru, mais intelectual, menos preocupado em soar polido.

A virada veio no início dos anos 1990, quando Nevermind do Nirvana estourou nas paradas e arrastou consigo toda uma cena. De repente, o alternativo era mainstream, e bandas como Smashing Pumpkins, Pearl Jam e Soundgarden dominavam as rádios que antes os ignoravam. O paradoxo do sucesso forçou o gênero a se reinventar constantemente.

Na segunda metade dos anos 1990, o alt rock se ramificou em dezenas de direções: o britpop de Blur e Oasis, o indie introspectivo de Elliott Smith, o noise-pop de Pavement, o post-grunge de Foo Fighters. Cada vertente mantinha a herança do DIY e da recusa ao conformismo, mesmo dentro de grandes gravadoras.

O vinil do rock alternativo tem um apelo especial para colecionadores: prensagens originais de álbuns como Murmur, Doolittle e Loveless são itens de alta procura, e as reedições em alta qualidade preservam as nuances analógicas que o CD frequentemente achata.`,

  "blues-rock": `O blues rock surgiu quando músicos britânicos dos anos 1960, como Eric Clapton, Jeff Beck e Jimmy Page, descobriram os discos de Muddy Waters, Robert Johnson e Howlin' Wolf e decidiram eletrificar aquela tradição com a intensidade de uma geração pós-guerra. O resultado foi um som que combinava a melancolia profunda do blues do Delta com a eletricidade crua do rock and roll nascente.

The Rolling Stones foram talvez os primeiros a levar essa fusão ao mundo de forma sistemática: seus primeiros álbuns são essencialmente covers e releituras de blues americano passadas pelo filtro da energia juvenil britânica. Jimi Hendrix foi além: transformou a guitarra elétrica numa extensão do corpo, numa voz, em algo que ninguém havia imaginado antes.

Nos anos 1970, o blues rock se tornou o DNA do hard rock e do heavy metal. Led Zeppelin, Deep Purple e Free beberam dessa fonte e a destilaram em formas progressivamente mais pesadas e teatrais. Mas a raiz permanecia sempre visível: o riff de "Whole Lotta Love" é, no fundo, uma frase de blues.

Hoje o blues rock vive um renascimento: artistas como Gary Clark Jr., Beth Hart e Jack White mantêm viva a conversa entre tradição e modernidade. No vinil, os discos originais de Cream, Fleetwood Mac (a formação com Peter Green) e John Mayall's Bluesbreakers são considerados registros históricos obrigatórios.`,

  "britpop": `O britpop foi um fenômeno tão cultural quanto musical. No início dos anos 1990, enquanto o grunge americano dominava o imaginário global, um grupo de bandas britânicas decidiu reafirmar a identidade insular do rock do Reino Unido, referenciando The Beatles, The Kinks e The Smiths em vez de Neil Young ou Black Sabbath.

Blur e Oasis foram os polos magnéticos dessa cena. O primeiro, intelectual e irônico, conectado à arte e ao experimentalismo; o segundo, direto, grandioso e deliberadamente trabalhador. A rivalidade entre os dois, encenada publicamente pela imprensa britânica como "The Battle of Britpop" em 1995, foi um exercício de marketing acidental que elevou ambos à estratosfera.

Mas o britpop era maior do que essa dupla. Pulp de Jarvis Cocker trouxe a perspectiva da classe trabalhadora com um humor ácido singular; Suede misturava androginia e melodrama à Bowie; Elastica comprimia o pós-punk dos anos 1970 em três minutos explosivos. A cena era rica, eclética e profundamente britânica.

O colapso veio rápido: (What's the Story) Morning Glory? de Oasis vendeu oito milhões de cópias no Reino Unido, e de repente o britpop se tornou grande demais para sua própria ideia. Blur respondeu com Blur (1997), seu álbum mais experimental. Suede implodiu e se reinventou. E então tudo acabou tão abruptamente quanto tinha começado.`,

  "classic-rock": `O classic rock é menos um subgênero do que uma canonização. É o conjunto de bandas e álbuns produzidos entre meados dos anos 1960 e fins dos anos 1970 que definiram o que o rock seria para o resto do século: Led Zeppelin, The Who, Pink Floyd, Rolling Stones, Eagles, Fleetwood Mac, Creedence Clearwater Revival.

Essa era foi marcada pela experimentação desinibida e pela ambição ilimitada. Os estúdios se tornavam cada vez mais sofisticados, os orçamentos cresciam, e as gravadoras, por enquanto, não questionavam o que os artistas faziam com eles. O resultado foram obras como Rumours, Dark Side of the Moon, Physical Graffiti e Hotel California: discos que vendiam milhões sem abrir mão da complexidade.

O formato LP era o medium perfeito para essa ambição. Com 20 a 25 minutos por lado, os artistas podiam construir narrativas, arcos temáticos e transições elaboradas que o single de três minutos nunca comportaria. A experiência de ouvir um álbum completo, sem shuffle e sem skip, era exatamente o que essas bandas tinham em mente.

Para colecionadores, o classic rock é o território mais disputado do mercado de vinil. Prensagens originais da Atlantic, Island e Harvest alcançam preços extraordinários, e mesmo reedições de alta qualidade, como as da Mobile Fidelity ou as Speakers Corner, são itens de grande valor. Um clássico bem preservado ainda soa melhor em vinil do que em qualquer formato digital.`,

  "folk-rock": `O folk rock nasceu de um confronto: quando Bob Dylan trocou o violão acústico pela guitarra elétrica no Newport Folk Festival de 1965, metade da plateia vaiou. A outra metade entendeu que estava presenciando uma transformação irreversível.

Dylan percebeu antes de qualquer um que as letras do folk, com sua tradição de contar histórias, de consciência social e de poesia vernacular americana, podiam sobreviver e prosperar num contexto elétrico. Bringing It All Back Home e Highway 61 Revisited são os documentos fundadores dessa fusão; Blonde on Blonde levou o experimento ao seu ápice.

Na Califórnia, Crosby, Stills, Nash & Young e os Byrds desenvolveram sua própria versão do folk rock: mais luminosa, mais harmônica, com raízes no bluegrass e no country folk da Costa Leste. Neil Young adicionou uma camada de distorção e ambiguidade emocional que seria influentíssima nos anos seguintes.

Fleetwood Mac (nas suas várias encarnações) e Joni Mitchell representam o amadurecimento do gênero nos anos 1970: música de câmara com alma folk, letras introspectivas, arranjos que podiam ser suaves ou elétricos conforme o momento pedisse. O folk rock nunca foi um gênero com um som uniforme. Era uma atitude, uma relação com a tradição oral americana que resistia ao descarte.`,

  "garage-rock": `O garage rock original surgiu nos Estados Unidos dos anos 1960: adolescentes com guitarras baratas, amplificadores pequenos e músicas simples gravadas em fins de semana. "Louie Louie" dos Kingsmen é o exemplo perfeito: imperfeita, urgente, irresistível. Era o rock antes de se tornar indústria.

O revival do garage rock no início dos anos 2000 foi um dos movimentos mais significativos da história recente do gênero. The Strokes com Is This It (2001) e The White Stripes com White Blood Cells (2001) chegaram quase simultaneamente com uma proposta simples: menos produção, mais energia. A reação contra o excesso de polimento dos anos 1990 era palpável.

The Hives, The Vines, The Libertines: uma enxurrada de bandas (muitas com "The" no nome) adotou a estética do lo-fi e da imperfeição como manifesto. Jack White foi além: com White Stripes e mais tarde com outros projetos, transformou a austeridade em sofisticação, mostrando que a limitação podia ser criativa.

No vinil, o garage rock soa especialmente natural: a compressão leve, os ataques de guitarra não polidos, os vocais quentes. Tudo isso vive melhor no analógico do que em formatos digitais que exigem uma perfeição técnica que o gênero nunca quis ter.`,

  "glam-rock": `O glam rock chegou nos anos 1970 como uma reação ao rock sério e pesado que o antecedeu. David Bowie criou Ziggy Stardust, uma persona alienígena andrógina; Marc Bolan do T. Rex encheu as rádios britânicas de boogie elétrico com cabelos cacheados e calças metálicas. Era uma declaração: o rock pode ser teatral, pode ser camp, pode ser moda.

Bowie foi o personagem central dessa cena, mas também o mais difícil de classificar. The Rise and Fall of Ziggy Stardust, Aladdin Sane, Diamond Dogs: cada álbum era uma reinvenção visual e sonora. Quando o glam ameaçava se tornar fórmula, Bowie já estava em outro lugar, absorvendo a soul de Philadelphia, o eletrônico de Berlim, o funk de Station to Station.

Roxy Music trouxe uma dimensão ainda mais sofisticada: Bryan Ferry era um dândi pós-moderno, e Brian Eno adicionava eletrônica experimental às bases do rock and roll. O primeiro álbum da banda, de 1972, soa como nada que havia sido feito antes. E muito do que viria depois no new wave e no synth-pop tem DNA direto de Roxy.

O legado do glam é vasto e inesperado: o punk aprendeu com sua atitude provocativa, o new wave com sua teatralidade, o pop com seu apelo à fantasia. E o vinil captura o brilho literal desses discos: a produção exuberante de um Ken Scott ou um Tony Visconti vive em toda sua glória nos sulcos analógicos.`,

  "grunge": `O grunge foi o último movimento rock a criar uma ruptura genuína com o mainstream antes de a internet fragmentar os gêneros para sempre. Seattle no final dos anos 1980 e início dos 1990 tinha uma cena específica, coerente, com seus próprios selos (Sub Pop), seus próprios locais (The Central Tavern, The Vogue) e seu próprio som: guitarras afinadas mais baixo, distorção pesada, letras que alternavam angústia e ironia.

Nirvana foi o acidente nuclear que expôs tudo isso ao mundo. Nevermind (1991) chegou sem aviso e vendeu 30 milhões de cópias, colocando Kurt Cobain numa posição que ele nunca quis: porta-voz de uma geração. Pearl Jam optou por uma abordagem mais clássica, o rock de arena com consciência social, e construiu uma das carreiras mais duradouras do período.

Soundgarden era o lado mais pesado e técnico do grunge: Chris Cornell tinha uma das vozes mais extraordinárias do rock, e as composições cruzavam heavy metal com psicodelia de uma forma que poucos conseguiam imitar. Alice in Chains trazia a escuridão ao extremo: discos como Dirt são documentos de um peso emocional quase insuportável.

O grunge morreu jovem enquanto movimento, mas deixou marcas profundas. A geração que cresceu com Nevermind e Badmotorfinger definiu o rock alternativo dos anos 2000. E hoje colecionadores disputam prensagens originais da Sub Pop e da DGC com o mesmo fervor que se reserva para os clássicos dos anos 1970.`,

  "hard-rock": `O hard rock emergiu no final dos anos 1960 quando bandas como Cream, The Who e o primeiro Led Zeppelin empurraram o blues rock em direção a algo mais pesado, mais alto e mais dramático. Era o volume como declaração artística: a distorção não como defeito técnico, mas como elemento expressivo.

Black Sabbath deu ao hard rock sua forma mais extrema: riffs lentos e pesados inspirados em filmes de terror, letras sobre guerra, paranoia e ocultismo, um som que parecia vir das entranhas da terra. Ozzy Osbourne, Geezer Butler, Tony Iommi e Bill Ward criaram inadvertidamente o heavy metal. Mas seu trabalho dos anos 1970 ainda é considerado hard rock em sua essência mais pura.

AC/DC escolheu um caminho diferente: simplicidade absoluta, repetição como virtude, a mesma fórmula aplicada álbum após álbum com precisão cirúrgica. Back in Black (1980) é um dos discos mais vendidos da história da música por uma razão: cada elemento está em seu lugar exato, sem nada sobrando ou faltando. É economia como arte.

Deep Purple, Aerosmith, Free e Bad Company completaram a cartografia do gênero nos anos 1970. Hoje, o hard rock vive na interseção entre nostalgia e descoberta: colecionadores buscam prensagens originais da Atlantic e da Purple Records, enquanto bandas contemporâneas como Greta Van Fleet atualizam a estética para novas audiências.`,

  "indie-rock": `O indie rock dos anos 2000 foi uma reinvenção do espírito punk e new wave numa era de internet nascente. The Strokes, com Is This It (2001), mostraram que era possível fazer rock que soava urgente e moderno sem abrir mão das melodias imediatas. A produção propositalmente lo-fi de Gordon Raphael capturou algo que o rock polido dos anos 1990 havia perdido.

Arctic Monkeys representaram o potencial transformador da internet: antes de ter um contrato com gravadora, suas demos circulavam em CDs queimados nos shows de Sheffield. Quando Whatever People Say I Am, That's What I'm Not saiu em 2006, tornou-se o álbum de estreia com vendas mais rápidas da história britânica. Era indie mas com alcance de arena.

Vampire Weekend trouxe outra dimensão: worldbeat, música clássica, literatura e ironia pós-moderna aplicados ao formato de canção de três minutos. LCD Soundsystem fundiu o indie rock com a dance music de uma forma que parecia impossível e inevitável ao mesmo tempo. Wilco construiu um dos catálogos mais consistentes do período, de Summerteeth a Yankee Hotel Foxtrot.

O indie rock é hoje o subgênero mais amplo e menos definível do rock: mais uma atitude e um circuito de distribuição do que um som específico. No vinil, as prensagens dos selos independentes, como Matador, Merge e XL Recordings, têm um valor especial para colecionadores que entendem a música como artefato cultural.`,

  "math-rock": `O math rock surgiu no final dos anos 1980 em Chicago e no meio-oeste americano, com bandas como Slint, Don Caballero e Shellac construindo uma abordagem radicalmente diferente para o rock: compassos assimétricos, métricas irregulares, estruturas que resistiam à expectativa do verso-refrão e se recusavam a resolver suas tensões harmonicamente.

Slint e seu álbum Spiderland (1991) são frequentemente citados como o ponto de origem: as guitarras cruzadas de David Pajo e Brian McMahan, as narrativas faladas de McMahan, a dinâmica extrema que ia do sussurro à explosão. Tudo isso criou um molde que seria seguido por décadas. Tecnicamente virtuoso mas emocionalmente perturbador.

A cena japonesa adotou o math rock e o transformou em algo mais melódico e contemplativo. Bandas como toe, tricot e LITE aplicaram as estruturas rítmicas complexas a composições que podiam ser ao mesmo tempo desafiadoras e belas. O resultado foi um subgênero globalizado, com seguidores fervorosos na Europa, no Japão e na América do Sul.

Battles, com Mirrored (2007), trouxe o math rock ao mainstream: a fusão de instrumentos acústicos com produção eletrônica densa criou um som que dialogava tanto com artistas eletrônicos quanto com guitarristas, ampliando a audiência do gênero sem diluir sua essência. No vinil, a textura rítmica do math rock ganha uma dimensão extra: a riqueza tonal das guitarras duplas preenche o espaço estéreo de uma forma que poucos gêneros conseguem.`,

  "new-wave": `O new wave emergiu do punk britânico no final dos anos 1970, mas foi na direção oposta: enquanto o punk valorizava brutalidade e recusa da técnica, o new wave abriu espaço para sofisticação, sintetizadores, ironia e influências que iam de Roxy Music a Kraftwerk. Era punk com vocabulário expandido.

Talking Heads foram o caso mais fascinante dessa transição: começaram como uma banda de punk minimalista de Nova York e evoluíram para uma das bandas mais criativas da era, incorporando world music, funk, afrobeat e produção de Brian Eno em álbuns como Remain in Light (1980). David Byrne era ao mesmo tempo um performer de alta ansiedade e um teórico da música popular.

Blondie combinava girl group dos anos 1960, punk, disco e new wave numa síntese que resultou em alguns dos singles mais memoráveis do final dos anos 1970. The Police construíam sobre reggae e ska uma estrutura pop inteligente. XTC, Elvis Costello, Squeeze: todos partilhavam a herança do pop artesanal britânico com a energia do punk.

O new wave teve uma vida longa porque era adaptável: no início dos anos 1980, quando os sintetizadores ficaram mais baratos, a cena se bifurcou em synth-pop (Depeche Mode, Human League) e post-punk mais austero (Joy Division, The Cure). Todas essas vertentes têm no new wave um ancestral comum, e o vinil dessas bandas tem um mercado de colecionadores extremamente ativo.`,

  "post-rock": `O post-rock é rock sem vocalistas. Ou, mais precisamente, é música que usa os instrumentos do rock (guitarra elétrica, baixo, bateria) mas recusa as suas estruturas convencionais. Sem versos, sem refrões, sem letra: apenas dinâmica, textura e construção emocional.

Bark Psychosis, Talk Talk e Slint criaram as fundações nos anos 1980 e início dos 1990. Mas foi o Tortoise de Chicago, com Millions Now Living Will Never Die (1996), que cristalizou o gênero: ritmos jazzísticos, guitarra etérea, arranjos cinematográficos, sem um único vocal. Era rock que se ouvia como música clássica contemporânea.

Godspeed You! Black Emperor tornaram o post-rock político e monumental: suas composições de 20 minutos começavam com samples de rádio, construíam lentamente até explosões orquestrais e terminavam em silêncio ou ruído. Discos como Lift Your Skinny Fists Like Antennas to Heaven (2000) são experiências totais, impossíveis de ouvir em segundo plano.

Explosions in the Sky popularizaram o gênero para uma geração através de trilhas sonoras de filmes independentes, com destaque para Friday Night Lights. Mogwai de Glasgow mantiveram a tradição de álbuns densos e emocionalmente exigentes. O post-rock é hoje um gênero global, com cenas vibrantes no Japão, na Argentina e na Escandinávia. E o vinil duplo ou triplo é o formato natural para composições que não cabem em um LP padrão.`,

  "progressive-rock": `O rock progressivo foi a aposta mais ambiciosa da era do rock: e se a música popular pudesse ter a complexidade e a seriedade da música clássica? Bandas como Yes, Genesis, King Crimson, Emerson Lake & Palmer e Rush rejeitaram os limites do single de três minutos e construíram suítes de 20 minutos, óperas-rock, composições em compasso 7/8 com letras sobre mitologia e ficção científica.

King Crimson lançou In the Court of the Crimson King em 1969 e imediatamente estabeleceu os parâmetros do gênero: Mellotron orquestral, guitarra de Robert Fripp elaborada até a abstração, letras herméticas. Yes respondeu com Close to the Edge (1972), que muitos consideram o ponto mais alto do prog: 37 minutos divididos em três faixas de arquitetura sinfônica perfeita.

Genesis era o lado mais teatral: Peter Gabriel usava fantasias elaboradas no palco, e álbuns como The Lamb Lies Down on Broadway (1974) eram narrativas densas de duplo LP. Quando Gabriel saiu e Phil Collins assumiu os vocais, a banda sobreviveu. E eventualmente se tornou uma das maiores do pop dos anos 1980, numa transformação que alguns classificam como traição e outros como genialidade.

Rush foi o caso anômalo: uma banda canadense de power trio que fazia prog sem as afetações britânicas, com letras libertárias inspiradas em Ayn Rand e um virtuosismo técnico extraordinário. Seu público de colecionadores é talvez o mais dedicado de qualquer banda de rock. No vinil, o prog exige prensagens de alta qualidade: a dinâmica extrema e a densidade orquestral de álbuns como Tales from Topographic Oceans precisam de cada mícron dos sulcos.`,

  "psychedelic-rock": `O rock psicodélico foi o som de uma geração convicta de que a consciência poderia ser expandida: pela música, pelas drogas, pela meditação, pela arte. Entre 1966 e 1971, bandas de San Francisco, Londres e Nova York criaram um corpo de obras que permanece entre os mais inventivos da história do rock.

The Beatles foram os catalisadores: Revolver (1966) e Sgt. Pepper's Lonely Hearts Club Band (1967) introduziram técnicas de estúdio, como gravação reversa, variações de pitch e loops de fita, que transformaram a produção musical. George Martin como cocriador e os próprios Beatles como experimentadores insaciáveis criaram um modelo de estúdio-como-instrumento que toda a psicodelia seguiu.

The Doors de Jim Morrison tinham uma qualidade diferente: mais sombria, mais literária, influenciada pelo surrealismo e pela poesia beat. A Jimi Hendrix Experience fundiu psicodelia com blues elétrico numa síntese que ainda parece impossível: os solos de Are You Experienced? soam como nenhuma outra coisa que havia existido. Jefferson Airplane e Grateful Dead representavam o lado comunitário de San Francisco, com uma música que servia à dança e ao transe coletivo.

Pink Floyd começou como uma banda psicodélica de culto londrina sob a liderança de Syd Barrett e evoluiu, após a saída dele, para algo mais introspectivo e grandioso. The Piper at the Gates of Dawn é um dos discos mais peculiares e fascinantes do período; o que a banda construiu depois é outra história.`,

  "rockabilly": `O rockabilly foi o primeiro rock: o momento em que o rhythm & blues dos negros americanos e o hillbilly country dos brancos sulistas se encontraram numa explosão juvenil que ninguém havia antecipado. Sam Phillips na Sun Records de Memphis foi o catalisador: quando um jovem caminhoneiro chamado Elvis Presley entrou no estúdio em 1954, o mundo mudou.

O rockabilly tinha uma estética física imediata: cabelo com brilhantina, jaquetas de couro, jeans rolados, sapatos sujos. Carl Perkins escreveu "Blue Suede Shoes" e Elvis a imortalizou. Jerry Lee Lewis tocava piano com os pés e cantava como se estivesse em chamas. Johnny Cash, antes de se tornar o "Man in Black" definitivo, gravava rockabilly austero sobre trens e trabalho.

A cena original durou apenas alguns anos, de 1954 a 1958 aproximadamente, antes de o pop suavizado do final da década varrer o estilo das paradas. Mas sobreviveu em subculturas dedicadas: a cena rockabilly britânica dos anos 1970 e 1980, o psychobilly de The Cramps, o neo-rockabilly de Stray Cats.

O rockabilly tem uma das comunidades de colecionadores mais devotas do mundo do vinil. Os 78rpm originais da Sun Records são artigos raríssimos, e mesmo as prensagens em 45rpm e LP dos anos 1950 são disputadas intensamente. A qualidade sonora das masterizações originais, diretas e sem camadas de processamento, faz esses discos soarem extraordinariamente vivos décadas depois.`,

  "shoegaze": `O shoegaze surgiu no Reino Unido no final dos anos 1980 e recebeu seu nome por uma razão visual: os guitarristas ficavam parados no palco, olhando para os pés, manipulando pedais de efeito. Em vez de espetáculo, havia imersão sonora total.

My Bloody Valentine definiram o gênero com Loveless (1991), um dos discos mais caros e demorados da história britânica: Kevin Shields levou anos aperfeiçoando o som, gastou o orçamento de uma gravadora inteira e criou algo que engenheiros de som ainda não conseguem explicar completamente. As guitarras de Loveless soam como nuvens, como névoa, como algo físico mas etéreo.

Slowdive e Ride representavam o lado mais melódico e menos extremo do shoegaze: onde MBV era denso e desorientante, Slowdive era contemplativo e belo, com harmonias etéreas de Rachel Goswell e Neil Halstead sobre camadas de reverb. Souvlaki (1993) é um dos discos mais adorados do gênero.

O shoegaze morreu como movimento em meados dos anos 1990, quando a mídia britânica declarou o britpop seu sucessor, mas nunca desapareceu de fato. A cena americana do slowcore, com Codeine e Low, tinha afinidades com ele; o dream pop californiano também. Nos anos 2000 e 2010, houve um revival explícito com bandas como Beach House, Deerhunter e No Age. E Slowdive e MBV voltaram a gravar: os novos álbuns são tão bons quanto os originais.`,

  "southern-rock": `O southern rock foi o primeiro estilo explicitamente regional do rock americano: música que não tentava esconder sua origem sulista, que celebrava estradas longas, verões quentes, rios largos e uma identidade que o resto dos Estados Unidos frequentemente ignorava ou caricaturizava.

Allman Brothers Band criaram o gênero quase do zero: "Melissa", "Ramblin' Man" e especialmente os longos jams de At Fillmore East (1971), um dos maiores álbuns ao vivo da história do rock, mostraram que o sul tinha sua própria contribuição a fazer além do blues e do country. Duane Allman era possivelmente o melhor guitarrista de slide que o rock já produziu.

Lynyrd Skynyrd foram a face mais agressivamente sulista do gênero: "Sweet Home Alabama" era uma resposta direta a Neil Young, e "Free Bird" tornou-se a canção definitiva do sul americano dos anos 1970. A tragédia do acidente aéreo de 1977, que matou Ronnie Van Zant e Steve Gaines, deu ao legado da banda uma dimensão mítica.

Charlie Daniels Band, Marshall Tucker Band, Wet Willie, Molly Hatchet: o southern rock tinha uma cena rica e diversa que a atenção concentrada em Allman Brothers e Skynyrd frequentemente obscurece. O vinil dessas bandas tem um mercado sólido de colecionadores, especialmente as prensagens originais da Capricorn Records, o selo independente que foi o coração da cena.`,
};

export function capitalize(name: string): string {
  return name.replace(/\b\w/g, (c) => c.toUpperCase());
}
