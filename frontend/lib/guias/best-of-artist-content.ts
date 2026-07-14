// Hand-written editorial content per artist. Keyed by artist slug.
// ALBUM_BLURBS sub-keys match the dedup key from best-of-artist-data.ts.

export const ARTIST_INTRO: Record<string, string> = {
  metallica: `O Metallica formou em Los Angeles em 1981, quando Lars Ulrich colocou um anúncio de classificados atrás de gente pra tocar heavy metal britânico e James Hetfield respondeu. Kirk Hammett entrou pouco antes do primeiro álbum no lugar de Dave Mustaine, expulso por brigas e bebida. Mustaine levou a raiva para o Megadeth e nunca deixou por menos nas entrevistas seguintes. Junto com Slayer e Anthrax, o Metallica ajudou a inventar o thrash metal: mais rápido e mais técnico que o heavy metal que tocava nas rádios até ali.

Poucas bandas viraram tão radicalmente quanto o Metallica virou entre 1988 e 1991. De banda de culto do thrash a fenômeno de MTV com o Black Album, mais de 30 milhões de cópias vendidas, um dos discos mais vendidos da história do rock. Parte da base original nunca perdoou. Outra parte nem sabia que existia um Metallica antes disso.

Este ranking usa a nota do MusicBrainz, ponderada pelo número de avaliações, combinada com o número de ouvintes no Last.fm. Abaixo de cada disco, um vídeo oficial de uma faixa representativa.`,

  "iron-maiden": `Steve Harris formou o Iron Maiden no leste de Londres em 1975 e é o único integrante presente em todos os discos até hoje. A banda surgiu dentro da NWOBHM, a nova onda do heavy metal britânico que também deu Def Leppard e Saxon, com um som mais rápido e técnico que o hard rock da década anterior.

Bruce Dickinson entrou como vocalista em 1981, a tempo do terceiro álbum, e saiu em 1993 para carreira solo. Voltou em 1999 junto com o guitarrista Adrian Smith, formando a linha de seis integrantes que a banda mantém até hoje. Entre a saída e o retorno de Dickinson, dois discos foram gravados com o vocalista Blaze Bayley, um período que a própria banda trata como capítulo à parte.

Este ranking usa a nota do MusicBrainz, ponderada pelo número de avaliações, combinada com o número de ouvintes no Last.fm. Abaixo de cada disco, um vídeo oficial de uma faixa representativa.`,

  megadeth: `Dave Mustaine formou o Megadeth em 1983, logo depois de ser expulso do Metallica por briga e abuso de álcool, episódio que carregou nas letras e nas entrevistas pelas quatro décadas seguintes. O impulso inicial era claro: tocar mais rápido e mais técnico que a banda que o dispensou. O Megadeth virou, ao lado do próprio Metallica, Slayer e Anthrax, um dos quatro grandes nomes do thrash metal americano.

A carreira teve dois desvios de rota marcantes. Em meados dos anos 1990 o som ficou mais melódico e comercial, recebido com desconfiança por boa parte da base thrash. E em janeiro de 2002 um dano no nervo do braço esquerdo de Mustaine quase acabou com a banda: os médicos disseram que ele nunca mais tocaria guitarra. Ele provou o contrário depois de mais de um ano de fisioterapia e voltou em 2004.

Este ranking usa a nota do MusicBrainz, ponderada pelo número de avaliações, combinada com o número de ouvintes no Last.fm. Abaixo de cada disco, um vídeo oficial de uma faixa representativa.`,
};

export const ALBUM_BLURBS: Record<string, Record<string, string>> = {
  metallica: {
    "master of puppets": `Se alguém pedir pra explicar o Metallica em oito minutos, é isso: a faixa-título muda de andamento umas seis vezes e nunca perde o fio. O terceiro álbum é consenso entre crítica, fãs e o próprio Metallica em entrevista como o auge do thrash da banda, e para muita gente do gênero inteiro. Foi o último disco com o baixista Cliff Burton. Ele morreu em setembro de 1986, num acidente de ônibus na turnê europeia, meses depois do lançamento.`,

    "ride the lightning": `O disco onde o Metallica aprendeu a compor, não só a tocar rápido. "Fade to Black" é a primeira balada da banda, e na época soou como traição pra parte da cena thrash. A mesma acusação voltaria a cada disco em que eles tentassem algo diferente pelos 30 anos seguintes. "For Whom the Bell Tolls" saiu do romance de Hemingway; "Creeping Death", de um filme sobre Moisés. Ninguém mais no thrash de Los Angeles em 1984 estava escrevendo assim.`,

    "...and justice for all": `O baixo de Jason Newsted praticamente sumiu na mixagem final, decisão que gerou teoria da conspiração por décadas, embora ninguém na banda jamais tenha dado uma explicação satisfatória. Tirando isso, é um disco de faixas longas e labirínticas, puro exercício técnico. E foi com ele que o Metallica virou banda de MTV: o clipe de "One", cortado com cenas do filme antiguerra "Johnny Got His Gun", foi o primeiro grande sucesso da banda na emissora.`,

    "kill em all": `Gravado em 1983 com orçamento de banda de garagem que era, literalmente, uma banda de garagem. Dave Mustaine tinha sido expulso poucas semanas antes das gravações (problema de bebida e briga, segundo quase todo relato da época) e Kirk Hammett entrou correndo pra aprender as músicas a tempo. O título original ia ser "Metal Up Your Ass"; a gravadora vetou. Cru, rápido demais pro heavy metal da época, e ainda assim um dos discos fundadores do thrash.`,

    "metallica": `O Black Album divide opinião até hoje, e a divisão é sempre a mesma: pra quem chegou com "Enter Sandman" tocando no rádio, é o melhor disco da banda. Pra quem já ouvia desde Kill 'Em All, é o dia em que o Metallica trocou a complexidade thrash por riffs diretos e produção de Bob Rock pensada pra rádio. As duas leituras estão certas. O disco vendeu mais de 30 milhões de cópias, um dos mais vendidos da história do rock, e continua sendo, pra boa parte do público geral, o único disco de metal que essas pessoas conhecem.`,

    "load": `Cabelo cortado, capa com uma obra do fotógrafo Andres Serrano feita de sangue e sêmen misturados entre placas de acrílico, som mais groovy puxando pra southern rock. Foi a mudança mais comentada da carreira do Metallica, e ainda divide a base de fãs décadas depois: alguns tratam Load como traição, outros como o disco mais corajoso que a banda já fez. "Until It Sleeps" e "King Nothing" seguram o argumento dos segundos.`,

    "reload": `Gravado nas mesmas sessões de Load e lançado um ano depois. O material sobrou e virou disco à parte, com a mesma produção polida de Bob Rock e o mesmo groove mais lento. "The Memory Remains", com Marianne Faithfull nos vocais, e o abridor rápido "Fuel" são os pontos altos de um disco que os próprios fãs chamam de irmão menos lembrado da era Load.`,

    "death magnetic": `Depois de St. Anger, o Metallica chamou Rick Rubin pra produzir a volta às raízes: solos de guitarra de volta, riffs com a agressividade de Ride the Lightning, "The Day That Never Comes" reconectando com quem tinha desistido da banda nos anos 2000. O problema veio na masterização, comprimida ao extremo, caso de manual da "guerra do volume" em fórum de áudio, a ponto de a versão do disco no jogo Guitar Hero soar melhor que o CD.`,

    "hardwired to self-destruct": `Disco duplo, décimo álbum de estúdio, resumo de quatro décadas: a velocidade do thrash inicial, os refrões diretos da era Black Album, produção limpa sem soar artificial. "Moth Into Flame" e "Atlas, Rise!" têm uma banda de sessentões tocando como se tivesse voltado à garagem em San Francisco. Foi recebido, quase sem ressalva, como o melhor disco do Metallica em quase 20 anos.`,

    "st anger": `É fácil zoar o som de caixa clara. Parece lata batendo, e não é força de expressão, é literalmente como soa. Mas o disco mais odiado do Metallica também é o mais documentado: "Some Kind of Monster" mostra a banda em terapia de grupo, filmando as próprias sessões, enquanto Jason Newsted sai, James Hetfield entra em reabilitação e ninguém sabe se o grupo sobrevive ao próprio disco. Sem nenhum solo de guitarra em lugar nenhum, decisão deliberada, não falta de tentativa. Musicalmente é o pior da carreira pra quase todo mundo. Como retrato de uma banda quase se destruindo em tempo real, não tem comparação na discografia.`,

    "garage inc": `Uma coletânea de covers: o EP "The $5.98 E.P. - Garage Days Re-Revisited" de 1987 somado a gravações novas de Diamond Head, Thin Lizzy, Nick Cave, funcionando como a lista de influências do Metallica declarada em forma de álbum. Ninguém compra Garage Inc esperando um disco autoral. Compra pra descobrir de onde veio o resto.`,

    "metallica 72 seasons vinil edição limitada lp colorido amarelo e preto exclusivo walmart": `"72 seasons" são os 18 primeiros anos de vida, a ideia de James Hetfield de que a gente é moldado antes mesmo de perceber que está sendo moldado. É o tema por trás do 11º álbum de estúdio, lançado em 2023, e o disco entrega isso em faixas longas e pesadas que lembram mais ...And Justice for All do que qualquer coisa da era Load pra cá.`,
  },

  "iron-maiden": {
    "iron maiden": `O primeiro disco, gravado com o vocalista Paul Di'Anno, tem mais punk que os discos que vieram depois. Steve Harris já compunha em assinaturas de tempo estranhas para o padrão do heavy metal de 1980, mas o disco ainda soa cru, quase de garagem. A capa trouxe Eddie pela primeira vez, o mascote zumbi que ilustraria praticamente toda a discografia seguinte, pintado por Derek Riggs.`,

    killers: `Último disco com Di'Anno nos vocais e primeiro com Adrian Smith na guitarra, que substituiu Dennis Stratton logo depois da estreia. O produtor Martin Birch, vindo do Deep Purple e do Rainbow, deu ao Iron Maiden um som mais definido pela primeira vez. "Ides of March" é quase toda instrumental, um formato raro para uma banda ainda tentando se firmar comercialmente.`,

    "the number of the beast": `Bruce Dickinson estreou nos vocais neste disco, depois de Di'Anno ser dispensado por questões de comportamento e estilo de vida. A faixa-título gerou fogueiras de discos nos Estados Unidos, acusada de satanismo por grupos religiosos que claramente não leram a letra até o fim (é sobre um pesadelo, não sobre culto a nada). "Run to the Hills" virou hino, e o disco colocou o Iron Maiden entre os grandes nomes do metal mundial.`,

    "piece of mind": `Primeiro álbum com o baterista Nicko McBrain, que segue na banda mais de quarenta anos depois. "The Trooper" foi inspirada na Carga da Brigada Ligeira, a batalha da Guerra da Crimeia imortalizada no poema de Tennyson, e o clipe mostra Dickinson vestido de soldado britânico com uma bandeira em cada apresentação ao vivo desde então. A capa traz Eddie de camisa de força num hospício.`,

    powerslave: `Tema egípcio, uma das turnês mais longas da história do rock (mais de treze meses, o World Slavery Tour) e "2 Minutes to Midnight", sobre a indústria bélica lucrando com guerra. O esgotamento da turnê é audível no próprio disco seguinte de estúdio, que levaria mais tempo que o normal para sair. Deu origem ao álbum ao vivo Live After Death, um dos mais respeitados do gênero.`,

    "somewhere in time": `Primeiro disco do Iron Maiden com sintetizadores de guitarra, tecnologia nova na época que deixou parte da base de fãs desconfiada. A capa, inspirada em Blade Runner, é uma das mais detalhadas da carreira, cheia de referências escondidas aos discos anteriores. "Wasted Years", escrita por Adrian Smith sobre a saudade de casa em turnê, é a faixa mais tocada do álbum até hoje.`,

    "seventh son of a seventh son": `Álbum conceitual baseado em folclore britânico sobre o sétimo filho de um sétimo filho, com teclado em papel de destaque pela primeira vez. "Can I Play with Madness" chegou ao Top 3 do Reino Unido e teve Graham Chapman, do Monty Python, no clipe. É o último disco antes de Adrian Smith deixar a banda, cansado dos rumos que viriam a seguir.`,

    "no prayer for the dying": `Gravado numa fazenda transformada em estúdio, com produção deliberadamente mais crua depois dos excessos sonoros do disco anterior. Janick Gers substituiu Adrian Smith na guitarra. "Bring Your Daughter... to the Slaughter" tinha sido escrita para a trilha de Pesadelo em Elm Street 5 e virou o único single do Iron Maiden a chegar ao número 1 no Reino Unido.`,

    "fear of the dark": `Último disco antes de Bruce Dickinson anunciar a saída da banda, o que só se tornou público durante a turnê seguinte. A faixa-título, sobre o medo do escuro na infância, virou um dos maiores hinos de plateia do Iron Maiden, cantada em coro em quase todo show desde então independente de qual disco está sendo divulgado.`,

    "the x factor": `Primeiro disco sem Bruce Dickinson, com o vocalista Blaze Bayley assumindo os vocais e um tom mais sombrio, influenciado pelo divórcio de Steve Harris na época. Foi recebido com desconfiança pela crítica e pelos fãs acostumados à voz de Dickinson. "Man on the Edge" foi inspirada no filme Um Dia de Fúria, com Michael Douglas.`,

    "virtual xi": `Segundo e último disco com Blaze Bayley, lançado durante a Copa do Mundo de 1998 com capa e turnê temáticas de futebol. É geralmente citado como o ponto mais baixo da discografia, e Bayley deixaria a banda logo depois, por dificuldades vocais em manter o repertório ao vivo. "Futureal" é a faixa mais rápida do disco.`,

    "brave new world": `Bruce Dickinson e Adrian Smith voltaram para este disco, formando pela primeira vez a formação de seis integrantes e três guitarristas que o Iron Maiden mantém até hoje. Foi tratado, com razão, como o grande retorno da banda depois da fase Blaze Bayley. "The Wicker Man" abriu a era com uma das faixas mais tocadas ao vivo desde então.`,

    "dance of death": `Deu sequência ao impulso de Brave New World, com "Paschendale" revivendo a Primeira Guerra Mundial em quase nove minutos de mudanças de andamento. A capa, toda em computação gráfica com erros visuais visíveis no fundo, é frequentemente citada em listas das piores artes de disco do metal. "Wildest Dreams" é o lado mais direto e acessível do disco.`,

    "a matter of life and death": `Disco conceitual sobre guerra, tocado quase inteiro ao vivo na turnê seguinte, uma aposta arriscada para uma banda com décadas de clássicos que o público esperava ouvir. "Different World" foi o single de apresentação, mais direto que o resto do álbum, que investe em faixas longas e letras políticas.`,

    "the final frontier": `Tema espacial e "El Dorado" rendeu ao Iron Maiden o primeiro Grammy da carreira, de Melhor Performance de Metal em 2011, depois de duas indicações anteriores sem vitória. A canção também dá nome à faixa que abre o disco, sobre a ganância atrás da lenda da cidade de ouro.`,

    "the book of souls": `Primeiro disco duplo do Iron Maiden, gravado enquanto Bruce Dickinson enfrentava, sem que a banda soubesse ainda a gravidade, os primeiros sintomas do câncer de língua que seria diagnosticado assim que as gravações terminaram. Ele decidiu terminar todos os vocais antes de procurar um médico. "Empire of the Clouds", com dezoito minutos, é a faixa mais longa da carreira da banda.`,

    senjutsu: `Tema samurai e xamânico, gravado antes da pandemia mas lançado só em 2021 por causa do atraso forçado pela COVID. "The Writing on the Wall" foi a primeira música nova do Iron Maiden em seis anos, e o clipe animado usa uma estética de faroeste que remete ao clima geral do disco.`,
  },

  megadeth: {
    "killing is my business... and business is good!": `O disco de estreia foi gravado com pressa e orçamento mínimo, meses depois de Dave Mustaine ser expulso do Metallica. O som é mais cru e desorganizado que qualquer disco seguinte da banda, quase punk em alguns trechos, mas já mostra a velocidade e a raiva que definiriam o Megadeth. Uma versão remixada saiu em 2002 porque Mustaine nunca gostou da mixagem original.`,

    "peace sells but who's buying": `O riff de baixo de "Peace Sells" ficou tão famoso que a MTV o usou como tema de abertura do próprio noticiário musical por anos, provavelmente mais gente reconhece esse riff do que sabe de onde ele veio. A capa, com o mascote Vic Rattlehead diante da sede da ONU, resume a postura política que o Megadeth manteria pelas quatro décadas seguintes.`,

    "so far so good: so what": `Inclui um cover de "Anarchy in the UK", dos Sex Pistols, e foi gravado em meio a uso pesado de drogas por parte da banda, o que Mustaine reconheceria décadas depois em entrevistas. A mixagem original desagradou tanto ao próprio grupo que ganhou um remix completo em 2002, quase quinze anos depois do lançamento.`,

    "rust in peace": `Considerado por boa parte da crítica e dos fãs o melhor disco da carreira, gravado com a formação que muitos chamam de clássica: Marty Friedman na guitarra e Nick Menza na bateria, entrando depois de Mustaine praticamente refazer a banda do zero. "Holy Wars... The Punishment Due" fala de conflito religioso inspirada nas guerras dos Bálcãs, que estavam começando naquele momento.`,

    "countdown to extinction": `O disco mais vendido do Megadeth, com um som mais direto e acessível que abriu a banda pra rádio sem perder a identidade thrash. "Symphony of Destruction" virou a faixa mais tocada da carreira. A capa, de Hugh Syme, mostra um homem levitando numa cela de prisão, e a contracapa traz o mascote Vic Rattlehead ao lado de um ábaco de caveiras, uma contagem regressiva visual para a extinção que dá nome ao disco.`,

    youthanasia: `Continuou a virada pra um som mais melódico começada no disco anterior, decisão que afastou parte da base mais fiel ao thrash. "À Tout Le Monde" gerou controvérsia por décadas, lida por muita gente como uma canção pró-suicídio, o que Mustaine sempre negou, dizendo que a letra é sobre aceitar a própria mortalidade, não sobre desistir da vida.`,

    "cryptic writings": `Empurrou o Megadeth ainda mais pra dentro do rock de rádio, com "Trust" e "Almost Honest" tocando ao lado de bandas bem distantes do metal. Foi o disco que consolidou a fase mais comercial da banda, a mesma que provocaria a reação mais dura dos fãs old school no álbum seguinte.`,

    risk: `O ponto mais baixo da carreira na opinião de quase todo mundo, incluindo o próprio Mustaine, que anos depois chamaria a decisão de investir pesado em rock pop de "erro". "Insomnia" e o resto do disco soam mais próximos de rock alternativo dos anos 1990 que de qualquer coisa que o Megadeth tinha feito antes. A reedição remixada tentou consertar parte do problema, sem sucesso total.`,

    "the world needs a hero": `Tentativa de voltar a um som mais pesado depois da reação negativa a Risk, gravado pouco antes do acidente que quase encerrou a carreira de Mustaine. "Moto Psycho" e "Dread and the Fugitive Mind" mostram a banda tentando recuperar a identidade thrash sem abandonar de vez os refrões mais diretos da fase anterior.`,

    "the system has failed": `Disco do retorno depois do hiato forçado pela lesão no braço de Mustaine, gravado quase sozinho por ele com uma equipe de músicos de sessão, já que a formação anterior do Megadeth tinha se desfeito durante a pausa. "Of Mice and Men" e o resto do disco voltam ao peso e à velocidade que Risk tinha abandonado.`,

    "united abominations": `Primeira formação estável depois do retorno de 2004, com letras politicamente carregadas mesmo pelos padrões do próprio Megadeth. Traz uma versão refeita de "À Tout Le Monde" com a vocalista Cristina Scabbia, do Lacuna Coil, subtitulada "Set Me Free".`,

    endgame: `Reencontro com Chris Broderick na guitarra e Shawn Drover na bateria, considerado pela crítica um retorno sólido à forma depois de uma década de idas e vindas. "Head Crusher" é rápida e agressiva o suficiente pra lembrar Rust in Peace, e o disco em geral é visto como o início de uma fase mais estável pra banda.`,

    th1rt3en: `O nome marca o décimo terceiro álbum de estúdio, e o disco também marcou a volta do baixista original David Ellefson depois de anos afastado da banda por causa de um processo judicial que ele e Mustaine moveram um contra o outro em 2004. "Public Enemy No. 1" foi uma das últimas músicas escritas antes da reconciliação virar oficial.`,

    "super collider": `Puxou o som de volta pra um lado mais melódico e hard rock, repetindo até certo ponto o caminho de Risk quinze anos antes, o que dividiu a recepção crítica na época. "Kingmaker" é a faixa mais citada de um disco que a própria banda revisitaria pouco depois com um retorno ao peso.`,

    dystopia: `Trouxe o guitarrista Kiko Loureiro, ex-Angra, pra formação, e rendeu ao Megadeth o primeiro Grammy da carreira depois de doze indicações sem vitória: Melhor Performance de Metal, em 2017, pela faixa-título. Na cerimônia, a banda tocou um trecho de "Master of Puppets" do Metallica em vez da própria música, uma piada com décadas de rivalidade entre as duas bandas.`,

    "the sick, the dying. and the dead!": `Atrasado por anos de turbulência na formação, incluindo a saída conturbada de David Ellefson em 2021 após um escândalo público, o disco chegou com James LoMenzo de volta ao baixo. "We'll Be Back" é a primeira parte de uma trilogia de faixas que a banda promete concluir nos discos seguintes.`,

    megadeth: `O disco de despedida, lançado em janeiro de 2026 como o décimo sétimo e último álbum de estúdio da banda, segundo o próprio Mustaine. Estreou em primeiro lugar na Billboard 200, a única vez que o Megadeth chegou ao topo da parada. Traz uma regravação de "Ride the Lightning", canção que Mustaine coescreveu com James Hetfield, Cliff Burton e Lars Ulrich ainda nos tempos de Metallica, antes de ser expulso da banda.`,
  },
};
