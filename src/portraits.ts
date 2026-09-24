export interface PortraitCredit {
  file: string;
  year: number;
  author: string;
  license: string;
  licenseUrl: string;
}

const bySurname: Record<string, PortraitCredit> = {
  LECLERC: {
    year: 2020,
    file: "Charles Leclerc portrait 2020.png",
    author: "Gilzetbase / DaanTW",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  },
  HAMILTON: {
    year: 2022,
    file: "Lewis Hamilton 2022 São Paulo Grand Prix (52497848109) (cropped).jpg",
    author: "Governo do Estado de São Paulo / Beto Issa",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0/",
  },
  HAMILTON_FERRARI: {
    year: 2025,
    file: "2025 Japan GP - Ferrari - Lewis Hamilton - Fanzone Stage (cropped).jpg",
    author: "Liauzh",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  },
  ALONSO: {
    year: 2025,
    file: "2025 Japan GP - Aston Martin - Fernando Alonso - Fanzone Stage (cropped).jpg",
    author: "Liauzh",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  },
  STROLL: {
    year: 2025,
    file: "2025 Japan GP - Aston Martin - Lance Stroll - Fanzone Stage (cropped).jpg",
    author: "Liauzh",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  },
  VERSTAPPEN: {
    year: 2024,
    file: "2024-08-25 Motorsport, Formel 1, Großer Preis der Niederlande 2024 STP 3973 by Stepro (portrait cropped).jpg",
    author: "Steffen Prößdorf",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  },
  NORRIS: {
    year: 2024,
    file: "2024-08-25 Motorsport, Formel 1, Großer Preis der Niederlande 2024 STP 3968 by Stepro (Lando Norris).jpg",
    author: "Steffen Prößdorf",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  },
  PIASTRI: {
    year: 2024,
    file: "Oscar Piastri 2024.jpg",
    author: "Merica F1",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0/",
  },
};

export function portraitFor(
  name: string,
  season?: number,
): (PortraitCredit & { url: string; source: string }) | null {
  const surname = name.trim().split(/\s+/).at(-1)?.toUpperCase();
  const key =
    surname === "HAMILTON" && season && season >= 2025
      ? "HAMILTON_FERRARI"
      : surname;
  const credit = key ? bySurname[key] : undefined;
  if (!credit) return null;
  const path = encodeURIComponent(credit.file).replace(/%2F/g, "/");
  return {
    ...credit,
    url: `https://commons.wikimedia.org/wiki/Special:FilePath/${path}?width=700`,
    source: `https://commons.wikimedia.org/wiki/File:${path}`,
  };
}
