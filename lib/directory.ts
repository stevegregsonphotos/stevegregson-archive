export const directory = {
  venues: {
    "Kiln Theatre": {
      url: "https://kilntheatre.com",
    },

    "Young Vic Theatre": {
      url: "https://www.youngvic.org",
    },

    Mountview: {
      url: "https://www.mountview.org.uk",
    },

    "Marylebone Theatre": {
      url: "https://www.marylebonetheatre.com",
    },
  },

  companies: {
    "Deus Ex Machina Productions": {
      url: "https://www.demproductions.co.uk",
    },
  },

  people: {
    "Lucía Sánchez Roldán": {
      url: "https://www.luciasanchezroldan.com",
    },

    "Mark Dymock": {
      url: "https://www.markdymock.com",
    },
  },
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