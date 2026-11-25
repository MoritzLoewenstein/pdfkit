const links = [...document.querySelectorAll('.sidebar a[href^="#"]')];
const sections = links.map((link) =>
  document.getElementById(decodeURIComponent(link.hash.slice(1))),
);

function select(section) {
  for (const [index, link] of links.entries()) {
    if (sections[index] === section)
      link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  }
}

function selectFromHash() {
  try {
    select(document.getElementById(decodeURIComponent(location.hash.slice(1))));
  } catch {
    // Ignore malformed fragment URLs.
  }
}

let scheduled = false;
window.addEventListener(
  'scroll',
  () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      select(
        sections.findLast(
          (section) =>
            section?.getBoundingClientRect().top <= window.innerHeight / 3,
        ),
      );
    });
  },
  { passive: true },
);
window.addEventListener('hashchange', selectFromHash);
selectFromHash();
