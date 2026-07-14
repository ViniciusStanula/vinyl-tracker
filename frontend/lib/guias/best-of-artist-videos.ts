// Colloquial/reissue album titles that MusicBrainz catalogs as a separate
// release-group from the "real" title, so text-based dedup can't merge them
// on its own (e.g. a "2024 remaster" reissue titled "The Black Album" is a
// different mb_mbid than the original "Metallica" release-group).
// Keyed by [artist slug][alias dedup key] -> canonical dedup key.
export const ARTIST_ALIASES: Record<string, Record<string, string>> = {
  metallica: {
    "the black album": "metallica",
  },
};

// Releases that are technically mb_primary_type='Album' in our data but
// aren't studio albums (live records, orchestral collaborations) — wrong to
// rank alongside real studio LPs in a "melhores discos" list. We don't store
// MusicBrainz secondary-type (Live/Compilation) so this has to be curated
// by hand. Keyed by [artist slug][dedup key].
export const ARTIST_EXCLUDE: Record<string, Set<string>> = {
  metallica: new Set([
    "s&m2", // orchestral live album w/ SF Symphony — not a studio album
  ]),
  "iron-maiden": new Set([
    "lp vinil iron maiden",                                          // "LP VINIL Iron Maiden - Live After Death" (live album)
    "nights of the dead, legacy of the beast: live in mexico city",  // live album
    "japan 81",                                                       // live album
  ]),
  megadeth: new Set([
    "unplugged in boston", // real Alice in Chains release, wrongly tagged artista='Megadeth' in our catalog
  ]),
};

// Hand-picked official YouTube video per album, one flagship track each.
// Keyed by [artist slug][dedup key of the album title] -> YouTube video ID.
// Album not listed here = ranking still shows it, just without a video embed.
export const ARTIST_VIDEOS: Record<string, Record<string, string>> = {
  metallica: {
    "kill em all": "beWvPkYHaic",                 // Whiplash (Remastered)
    "ride the lightning": "9HZ_tx8aWuA",           // Fade to Black (Remastered) — official video is age-restricted, can't embed
    "master of puppets": "c65yR7FWJsM",            // Master of Puppets (Remastered) — official video is age-restricted, can't embed
    "...and justice for all": "WM8bTdBs-cw",       // One
    "metallica": "CD-E-LDc384",                    // Enter Sandman
    "load": "eRV9uPr4Dz4",                         // Until It Sleeps
    "reload": "RDN4awrpPQQ",                       // The Memory Remains
    "death magnetic": "K6AJuRK2NE4",               // The Day That Never Comes
    "hardwired to self-destruct": "4tdKl-gTpZg",   // Moth Into Flame
    "st anger": "3rFoGVkZ29w",                     // St. Anger
    "garage inc": "wsrvmNtWU4E",                   // Whiskey in the Jar
    "metallica 72 seasons vinil edição limitada lp colorido amarelo e preto exclusivo walmart": "_u-7rWKnVVo", // Lux Æterna
  },

  "iron-maiden": {
    "iron maiden": "kbK9vqF8EOc",                  // Running Free
    killers: "ViZbO0fl0q0",                        // Wrathchild
    "the number of the beast": "86URGgqONvA",      // Run to the Hills
    "piece of mind": "X4bgXH3sJ2Q",                // The Trooper
    powerslave: "9qbRHY1l0vc",                     // 2 Minutes to Midnight
    "somewhere in time": "Ij99dud8-0A",            // Wasted Years
    "seventh son of a seventh son": "Kvqr366Op3k", // Can I Play with Madness
    "no prayer for the dying": "m0J7XnbUN5o",      // Bring Your Daughter... to the Slaughter
    "fear of the dark": "L4EDWVbNKnM",             // Fear of the Dark
    "the x factor": "u5UqJWRV55E",                 // Man on the Edge
    "virtual xi": "E9yLBNa-iCQ",                   // Futureal
    "brave new world": "-sQ3Af3DpeM",              // The Wicker Man
    "dance of death": "fX5aMvCd7JE",               // Wildest Dreams
    "a matter of life and death": "jvnfCfWnybY",   // Different World
    "the final frontier": "uibUIN4nzYk",           // El Dorado
    "the book of souls": "-F7A24f6gNc",            // Speed of Light
    senjutsu: "FhBnW7bZHEE",                       // The Writing on the Wall
  },

  megadeth: {
    "peace sells but who's buying": "gBEZQdks1f0", // Peace Sells
    "so far so good: so what": "mW0Ao9r2zkY",      // In My Darkest Hour
    "rust in peace": "9d4ui9q7eDM",                // Holy Wars... The Punishment Due
    "countdown to extinction": "vfpgpf6QVnI",      // Symphony of Destruction
    youthanasia: "aU-dKoFZT0A",                    // À Tout Le Monde
    "cryptic writings": "FDbG-Vt1PYs",             // Trust
    risk: "w45pn7CMsbA",                           // Insomnia
    "the world needs a hero": "8KVj2SF5CxU",       // Moto Psycho
    "the system has failed": "gqDMnuOMSqs",        // Of Mice and Men
    "united abominations": "tC0qJrfcQAc",          // À Tout Le Monde (Set Me Free)
    endgame: "QJOINz1aWj4",                        // Head Crusher
    th1rt3en: "fLN1OB3_wG8",                       // Public Enemy No. 1
    "super collider": "IgYOaUZ29ws",               // Kingmaker
    dystopia: "mEkXyEIu3OU",                       // Post American World
    "the sick, the dying. and the dead!": "LkJ5jJuraLQ", // We'll Be Back
    megadeth: "ECXg-a7XZQI",                       // Tipping Point
  },
};
