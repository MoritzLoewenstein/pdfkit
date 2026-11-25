import italicUrl from '/fonts/RobotoMono-Italic.ttf?url';
import regularUrl from '/fonts/RobotoMono-Regular.ttf?url';

export function loadFonts() {
  return Promise.all(
    [regularUrl, italicUrl].map(async (url) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Could not load font ${url} (${response.status}).`);
      }
      return response.arrayBuffer();
    }),
  );
}
