/**
 * Checks for lib/parse-pasted-credits.ts (the "Paste credits" box in Backstage).
 *
 * Run with:  npx tsx scripts/test-parse-pasted-credits.ts
 */
import assert from "node:assert/strict";

import { parsePastedCredits, type PastedCredit } from "../lib/parse-pasted-credits";

type Case = {
  name: string;
  input: string;
  credits: PastedCredit[];
  unparsed?: string[];
};

const c = (role: string, name: string): PastedCredit => ({ role, name });

const cases: Case[] = [
  {
    name: "colon, dashes, pipe and tab separators",
    input: [
      "Director: Jane Smith",
      "Lighting Designer – Bob Jones",
      "Sound Designer - Ama Mensah",
      "Choreographer | Lee Park",
      "Musical Director\tTom O'Neill",
    ].join("\n"),
    credits: [
      c("Director", "Jane Smith"),
      c("Lighting Design", "Bob Jones"),
      c("Sound Design", "Ama Mensah"),
      c("Choreographer", "Lee Park"),
      c("Musical Director", "Tom O'Neill"),
    ],
  },
  {
    name: "name first: brackets, comma and em dash",
    input: "Jane Smith (Director)\nBob Jones, Lighting Designer\nAma Mensah — Sound Designer",
    credits: [c("Director", "Jane Smith"), c("Lighting Design", "Bob Jones"), c("Sound Design", "Ama Mensah")],
  },
  {
    name: "role on one line, name on the next (theatre website)",
    input: "Creative Team\n\nDirector\nJane Smith\n\nSet and Costume Designer\nCleo Pettitt\n\nLighting Designer\nDavid W. Kidd\n\nMovement Director\nAnna Lee",
    credits: [
      c("Director", "Jane Smith"),
      c("Set & Costume Design", "Cleo Pettitt"),
      c("Lighting Design", "David W. Kidd"),
      c("Movement Director", "Anna Lee"),
    ],
  },
  {
    name: "name on one line, role on the next",
    input: "Jane Smith\nDirector\nBob Jones\nLighting Designer\nAma Mensah\nSound Designer",
    credits: [c("Director", "Jane Smith"), c("Lighting Design", "Bob Jones"), c("Sound Design", "Ama Mensah")],
  },
  {
    name: "'by' phrasing, including several on one line",
    input: [
      "Directed by Jane Smith",
      "Set and Costume Design by Cleo Pettitt",
      "Book by Dennis Kelly, Music and Lyrics by Tim Minchin",
      "Choreography by Peter Darling",
    ].join("\n"),
    credits: [
      c("Director", "Jane Smith"),
      c("Set & Costume Design", "Cleo Pettitt"),
      c("Book", "Dennis Kelly"),
      c("Music & Lyrics", "Tim Minchin"),
      c("Choreographer", "Peter Darling"),
    ],
  },
  {
    name: "several names for one role become separate credits",
    input: "Producers: Sonia Friedman, Tom Kirdahy and Hunter Arnold\nSound Design: Gareth Fry & Pete Malkin",
    credits: [
      c("Producer", "Sonia Friedman"),
      c("Producer", "Tom Kirdahy"),
      c("Producer", "Hunter Arnold"),
      c("Sound Design", "Gareth Fry"),
      c("Sound Design", "Pete Malkin"),
    ],
  },
  {
    name: "organisation names with commas are not split",
    input: "Commissioned by: King's College School, Wimbledon\nProducer: Smith & Jones Productions",
    credits: [c("Commissioned by", "King's College School, Wimbledon"), c("Producer", "Smith & Jones Productions")],
  },
  {
    name: "bullets, numbering, smart quotes, non-breaking spaces, footnotes, trailing punctuation",
    input: [
      "  • Director:\u00a0Jane\u00a0Smith.",
      "* Lighting Design: Rory O’Brien;",
      "· Sound:  Ama Mensah",
      "1. Choreographer: Lee Park[3]",
      "2) Writer: “Kit” Harrington",
      "- Associate Director: Sam Green,",
    ].join("\n"),
    credits: [
      c("Director", "Jane Smith"),
      c("Lighting Design", "Rory O'Brien"),
      c("Sound Design", "Ama Mensah"),
      c("Choreographer", "Lee Park"),
      c("Writer", '"Kit" Harrington'),
      c("Associate Director", "Sam Green"),
    ],
  },
  {
    name: "cast section becomes Cast credits; a later credit line ends it",
    input: "Cast\nAlice Brown\nTom Hughes as Mr Darcy\nPriya Shah (Elizabeth)\n\nCreatives\nDirector: Jane Smith",
    credits: [
      c("Cast", "Alice Brown"),
      c("Cast", "Tom Hughes"),
      c("Cast", "Priya Shah"),
      c("Director", "Jane Smith"),
    ],
  },
  {
    name: "unknown roles are kept in title case; known roles are normalised",
    input: "fight director: Kev McCurdy\nDRAMATURG: Ola Ince\nPuppetry Consultant: Finn Caldwell\nVideo Designer: Akhila Krishnan\nCasting by Pippa Ailion",
    credits: [
      c("Fight Director", "Kev McCurdy"),
      c("Dramaturg", "Ola Ince"),
      c("Puppetry Consultant", "Finn Caldwell"),
      c("Video Design", "Akhila Krishnan"),
      c("Casting Director", "Pippa Ailion"),
    ],
  },
  {
    name: "all-capital programme text is tidied",
    input: "DIRECTOR\nJANE SMITH\nLIGHTING DESIGNER\nRORY O'BRIEN\nSTAGE MANAGER\nMOLLY MCDONALD",
    credits: [c("Director", "Jane Smith"), c("Lighting Design", "Rory O'Brien"), c("Stage Manager", "Molly McDonald")],
  },
  {
    name: "lines that make no sense are reported, not guessed",
    input: "Hamilton is a sung-through musical about Alexander Hamilton.\nDirector: Thomas Kail\nRunning time: 2 hours 45 minutes\nShow more",
    credits: [c("Director", "Thomas Kail")],
    unparsed: ["Hamilton is a sung-through musical about Alexander Hamilton.", "Running time: 2 hours 45 minutes"],
  },
  {
    name: "duplicates within the paste are skipped",
    input: "Director: Jane Smith\nDirected by Jane Smith\nJane Smith (Director)",
    credits: [c("Director", "Jane Smith")],
  },
  {
    name: "Wikipedia infobox copied as label/value lines",
    input: "Hamilton\nMusical\nMusic\tLin-Manuel Miranda\nLyrics\tLin-Manuel Miranda\nBook\tLin-Manuel Miranda\nBasis\tAlexander Hamilton by Ron Chernow\nAwards: Tony Award for Best Musical",
    credits: [c("Music", "Lin-Manuel Miranda"), c("Lyrics", "Lin-Manuel Miranda"), c("Book", "Lin-Manuel Miranda")],
    unparsed: ["Hamilton", "Musical", "Basis\tAlexander Hamilton by Ron Chernow", "Awards: Tony Award for Best Musical"],
  },
  {
    name: "several names listed under one role heading",
    input: "Producers\nSonia Friedman\nTom Kirdahy\n\nDesigner\nEs Devlin",
    credits: [c("Producer", "Sonia Friedman"), c("Producer", "Tom Kirdahy"), c("Set & Costume Design", "Es Devlin")],
  },
  {
    name: "writer from a 'By ...' line and accented names",
    input: "By William Shakespeare\nDirector: Seán Linnen\nMovement: Zoë Ève",
    credits: [c("Writer", "William Shakespeare"), c("Director", "Seán Linnen"), c("Movement Director", "Zoë Ève")],
  },
  {
    name: "theatre website table with a cast list of actor/character pairs",
    input: "CREATIVE TEAM\nWriter\tLucy Kirkwood\nDirector\tJames Macdonald\nDesigner\tMiriam Buether\nComposer & Sound Designer\tMax & Ben Ringham\n\nCAST\nNancy Carroll\tRuth",
    credits: [
      c("Writer", "Lucy Kirkwood"),
      c("Director", "James Macdonald"),
      c("Set & Costume Design", "Miriam Buether"),
      c("Composer & Sound Design", "Max & Ben Ringham"),
    ],
    unparsed: ["Nancy Carroll\tRuth"],
  },
  {
    name: "names in capitals or lower case are recased; mixed case and initials are kept",
    input: [
      "LIGHTING DESIGN - SARAH McDONALD",
      "choreographer: amy macintyre",
      "MUSICAL DIRECTOR:\nPETER VAN DER BERG",
      "SOUND DESIGN \u2014 DJ KHALED-SMITH",
      "Set Design | ROSIE O'DONNELL-SMITH",
      "Producer: Danny DeVito",
      "Costume Design: MARY MACKENZIE",
      "Movement Director: J.R. HARTLEY",
      "Associate Director: Fiona MacKenzie",
      "writer: van der berg",
      "Commissioned by: GUILDHALL SCHOOL OF MUSIC AND DRAMA",
    ].join("\n"),
    credits: [
      c("Lighting Design", "Sarah McDonald"),
      c("Choreographer", "Amy Macintyre"),
      c("Musical Director", "Peter van der Berg"),
      c("Sound Design", "DJ Khaled-Smith"),
      c("Set Design", "Rosie O'Donnell-Smith"),
      c("Producer", "Danny DeVito"),
      c("Costume Design", "Mary Mackenzie"),
      c("Movement Director", "J.R. Hartley"),
      c("Associate Director", "Fiona MacKenzie"),
      c("Writer", "Van der Berg"),
      c("Commissioned by", "Guildhall School of Music and Drama"),
    ],
  },
  {
    name: "no separators left on either end of a role or name",
    input: "Director: - Jane Smith -\n| Lighting Design | Bob Jones |\nSound Design \u2013 \u2013 Ama Mensah \u2014\n: Choreographer : Lee Park :\nMOVEMENT DIRECTOR -\n- ANNA LEE -",
    credits: [
      c("Director", "Jane Smith"),
      c("Lighting Design", "Bob Jones"),
      c("Sound Design", "Ama Mensah"),
      c("Choreographer", "Lee Park"),
      c("Movement Director", "Anna Lee"),
    ],
  },
  {
    name: "'by' credits in separate sentences on one line (Wikipedia/Google)",
    input:
      "Book by Lin-Manuel Miranda, Music and Lyrics by Jason Robert Brown. Directed by Thomas Kail. Choreographed by Andy Blankenbuehler.",
    credits: [
      c("Book", "Lin-Manuel Miranda"),
      c("Music & Lyrics", "Jason Robert Brown"),
      c("Director", "Thomas Kail"),
      c("Choreographer", "Andy Blankenbuehler"),
    ],
  },
  {
    name: "initials before a full stop don't split a 'by' sentence",
    input: "Directed by J. R. Smith. Lighting by Bob Jones.",
    credits: [c("Director", "J. R. Smith"), c("Lighting Design", "Bob Jones")],
  },
  {
    name: "letters after a name stay in capitals",
    input: "CASTING DIRECTOR: Anna Bell CDG\nDIRECTOR: JANE SMITH OBE",
    credits: [c("Casting Director", "Anna Bell CDG"), c("Director", "Jane Smith OBE")],
  },
  {
    name: "two producing organisations are split; one company name is not",
    input: "Producers\nKiln Theatre and Sonia Friedman Productions\nProduced by Smith & Jones Productions",
    credits: [
      c("Producer", "Kiln Theatre"),
      c("Producer", "Sonia Friedman Productions"),
      c("Producer", "Smith & Jones Productions"),
    ],
  },
  {
    name: "empty input",
    input: "\n\n   \n",
    credits: [],
  },
];

let failed = 0;

const EDGE_SEPARATOR = /^[\s\-\u2013\u2014:|]|[\s\-\u2013\u2014:|]$/;

for (const testCase of cases) {
  const result = parsePastedCredits(testCase.input);
  try {
    for (const credit of result.credits) {
      assert.ok(!EDGE_SEPARATOR.test(credit.role), `separator left on role "${credit.role}"`);
      assert.ok(!EDGE_SEPARATOR.test(credit.name), `separator left on name "${credit.name}"`);
    }
    assert.deepEqual(result.credits, testCase.credits);
    if (testCase.unparsed) assert.deepEqual(result.unparsed, testCase.unparsed);
    else assert.deepEqual(result.unparsed, []);
    console.log(`PASS  ${testCase.name}`);
  } catch {
    failed += 1;
    console.log(`FAIL  ${testCase.name}`);
    console.log("  expected:", JSON.stringify({ credits: testCase.credits, unparsed: testCase.unparsed ?? [] }));
    console.log("  received:", JSON.stringify(result));
  }
}

console.log(`\n${cases.length - failed}/${cases.length} passed`);
if (failed) process.exit(1);
