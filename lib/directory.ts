export const directory = {
  venues: {
    "Kiln Theatre": {
    url: "https://kilntheatre.com",
  },
    "Orange Tree Theatre": { 
    url: "https://orangetreetheatre.co.uk/",
  },
    "Marlowe Theatre": { 
    url: "https://marlowetheatre.com/",
  },
    "Arcola Theatre": { 
    url: "https://www.arcolatheatre.com/",
  },
    "Jermyn Street Theatre": { 
    url: "https://www.jermynstreettheatre.co.uk/",
  },
    "Young Vic Theatre": { 
    url: "https://www.youngvic.org",
  },
    "Mountview": { 
    url: "https://www.mountview.org.uk",
  },
    "Marylebone Theatre": { 
    url: "https://www.marylebonetheatre.com",
  },
    "Arts Ed": { 
    url: "https://artsed.co.uk/",
  },
    "ArtsEd": { 
    url: "https://artsed.co.uk/",
  },
    "KCS": { 
    url: "https://www.kcs.org.uk/",
  },
    "Emil Dale": { 
    url: "https://www.emildale.co.uk/",
  },
    "GSA": { 
    url: "https://gsauk.org/",
  },
    "LSMT": { 
    url: "https://www.lsmt.co.uk/",
  },
    "Rose Bruford College": { 
    url: "https://www.bruford.ac.uk/",
  },
    "London Studio Centre": { 
    url: "https://www.londonstudiocentre.org/",
  },
    "London School of Musical Theatre": { 
    url: "https://www.lsmt.co.uk/",
  },
    "Guildhall School of Music and Drama": { 
    url: "https://www.gsmd.ac.uk/",
  },
    "Associated Studios": { 
    url: "https://associatedstudios.co.uk/",
  },
    "Chickenshed": { 
    url: "https://www.chickenshed.org.uk/",
  },
  },

  companies: {
    "Deus Ex Machina Productions": {
      url: "https://www.demproductions.co.uk",
    },
           "Mischief": {
    url: "https://www.mischiefcomedy.com/",
  },
          "Bill Kenwright Productions": {
    url: "https://www.kenwright.com/",
  },
                "London Gay Mens Chorus": {
    url: "https://www.lgmc.org.uk/",
  },
                      "London Youth Theatre": {
    url: "https://www.londonyouththeatre.org.uk/",
  },
                      "London Gay Men's Chorus": {
    url: "https://www.lgmc.org.uk/",
  },
          "Glyndebourne Opera": {
    url: "https://www.glyndebourne.com/",
  },
                "Hackney Empire": {
    url: "https://www.hackneyempire.co.uk/",
  },
      "City Academy": {
    url: "https://www.city-academy.com/musical-theatre-company?srsltid=AfmBOoouS_B2_WU97dfA7XfkIjYf-pOcibnG-CnvfI21EZ8WEzJ2gZw7",
  },
      "Park Theatre": {
    url: "https://parktheatre.co.uk/",
  },
            "Polka Theatre": {
    url: "https://polkatheatre.com/",
  },
                  "Regents Opera": {
    url: "https://regentsopera.com/",
  },
  },

people: {
  "Lucía Sánchez Roldán": {
    url: "https://www.luciasanchezroldan.com",
  },

    "Alex Musgrave": {

    url: "https://www.alex-musgrave.com",
  },
 "Chris Mould": {

    url: "https://www.chrismouldlighting.com",
  },
    "Damien Stanton": {

    url: "https://stanton.design",
  },
    "Jack Weir": {

    url: "https://www.weirdlighting.co.uk",
  },
    "Elliot Griggs": {

    url: "https://www.elliotgriggs.co.uk",
  },
    "Niall McKeever": {

    url: "https://www.niallmckeeverdesign.com/",
  },
    "Laura Ann Price": {

    url: "https://www.lauraannprice.co.uk/",
  },
    "Chris Mcdonnell": {

    url: "https://chris-mcdonnell.com/",
  },
    "Christopher Nairne": {

    url: "https://christophernairne.co.uk/",
  },
    "Andrew Exeter": {

    url: "https://www.andrewexeter.com/",
  },
    "Isabella Van Braeckel": {

    url: "https://isabellavanbraeckel.com/",
  },
     "Cory Anne Shipp": {

    url: "https://www.coryshippdesign.com/",
  },
     "Adam Foley": {

    url: "https://adamfoley.design/",
  },
"Ben Ormerod": {
  url: "https://www.benormerod.com/",
},
      "Holly Ellis": {

    url: "https://www.hollyellislighting.com",
  },
      "Mark Dymock": {

    url: "https://www.thealpd.org.uk/directory/MarkDymock1928?tab=biography",
  },
}
};
type DirectoryEntry = {
  url: string;
};

export function getDirectoryUrl(name: string) {
  const venues = directory.venues as Record<string, DirectoryEntry>;
  const companies = directory.companies as Record<string, DirectoryEntry>;
  const people = directory.people as Record<string, DirectoryEntry>;

  return (
    venues[name]?.url ??
    companies[name]?.url ??
    people[name]?.url
  );
}