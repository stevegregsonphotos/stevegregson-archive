import { getSectorData } from "../../lib/sectors";

/**
 * A plain-English summary for AI assistants (ChatGPT, Perplexity, Claude,
 * Google's AI answers), following the llms.txt convention.
 */
export const revalidate = 86400;

const SITE = "https://www.stevegregson.com";

export async function GET() {
  const { totalProductions } = await getSectorData();

  const body = `# Steve Gregson Photography

> Steve Gregson FRSA LBIPP is a London theatre photographer. He photographs production, dress rehearsal, rehearsal, backstage, marketing and PR images for theatres, producers, drama schools and opera companies across London, the UK and internationally.

- Based in London, United Kingdom. Works across the UK and internationally.
- Licentiate of the British Institute of Professional Photography (LBIPP), Fellow of the Royal Society of Arts (FRSA), award-winning member of the Federation of European Photographers.
- Almost two decades working inside theatre (performance, technical management, theatrical design, lighting and teaching) before photographing it.
- Photographs live performances and dress rehearsals with a silent shutter.
- Press selections within 24 hours when agreed; full edited sets within 5 working days.
- Clients include the Young Vic, Kiln Theatre, Orange Tree Theatre, Park Theatre, Jermyn Street Theatre, Arcola Theatre, Hackney Empire, Polka Theatre, Chickenshed, Glyndebourne, Waterperry Opera, Mountview, ArtsEd, Guildhall School of Music & Drama, Guildford School of Acting, Rose Bruford College and the London School of Musical Theatre.
- The online archive holds ${totalProductions} productions, each credited with its venue, cast and creative team.
- Contact: info@stevegregson.com · +44 (0) 7729 435 728

## Services

- [Commissions](${SITE}/commissions): how booking works, turnaround, licensing and FAQs
- [Production photography](${SITE}/production): performance and dress rehearsal photography
- [Rehearsal & backstage photography](${SITE}/rehearsals)
- [Marketing & PR photography](${SITE}/marketing-pr): campaign, poster and press images
- [Drama school photography](${SITE}/drama-school-photography): showcases and graduating-year productions
- [Opera photography](${SITE}/opera-photography)

## Work

- [Selected work](${SITE}/selected-work)
- [Production archive](${SITE}/archive): every production, searchable by title, venue and year
- [People](${SITE}/people): directors, designers, choreographers and performers credited in the archive
- [Venues](${SITE}/venues): theatres and venues photographed

## About

- [About Steve Gregson](${SITE}/about)
- [Contact](${SITE}/contact)
- [Terms & conditions](${SITE}/policies/terms)

## Profiles

- [Instagram](https://www.instagram.com/stevegregsonphotos/)
- [LinkedIn](https://www.linkedin.com/in/stevegregsonphotos/)
- [Facebook](https://www.facebook.com/stevegregsonphotos/)
- [X](https://x.com/stevegregson_)
- [ALPD photographer listing](https://www.thealpd.org.uk/photographer/steve-gregson)
- [Federation of European Photographers](https://www.europeanphotographers.eu/members/stevegregson/)
`;

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
