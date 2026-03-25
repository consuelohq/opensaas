async function loadGoogleFont(
  font: string,
  text: string,
  weight: number
): Promise<ArrayBuffer> {
  try {
    const API = `https://fonts.googleapis.com/css2?family=${font}:wght@${weight}&text=${encodeURIComponent(text)}`;

    const css = await (
      await fetch(API, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1",
        },
      })
    ).text();

    const resource = css.match(
      /src: url\((.+?)\) format\('(opentype|truetype)'\)/
    );

    if (!resource) {
      throw new Error("Failed to load font data");
    }

    const res = await fetch(resource[1]);
    return res.arrayBuffer();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    throw new Error(`Failed to load Google font: ${message}`);
  }
}

async function loadGoogleFonts(
  fonts: { name: string; weight: number; style: string }[],
  text: string
): Promise<
  Array<{
    name: string;
    data: ArrayBuffer;
    weight: number;
    style: string;
  }>
> {
  const fontsData = await Promise.all(
    fonts.map(async font => {
      try {
        const data = await loadGoogleFont(font.name, text, font.weight);
        return {
          name: font.name,
          data,
          weight: font.weight,
          style: font.style,
        };
      } catch (err: unknown) {
        return null;
      }
    })
  );
  return fontsData.filter((font): font is NonNullable<typeof font> => font !== null);
}

export default loadGoogleFonts;
