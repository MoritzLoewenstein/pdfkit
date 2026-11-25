import { access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const [, , repo, message = 'Update gh-pages branch'] = process.argv;

if (!repo) {
  console.error(
    'Usage: npm run publish-website -- <git-repository-url> [message]',
  );
  process.exitCode = 1;
} else {
  try {
    const publicDir = new URL('../public/', import.meta.url);
    await Promise.all([
      access(new URL('docs/index.html', publicDir)),
      access(new URL('docs/guide.pdf', publicDir)),
    ]);
    const { default: ghpages } = await import('gh-pages');
    await ghpages.publish(fileURLToPath(publicDir), {
      src: 'docs/**/*',
      add: true,
      message,
      repo,
    });
    console.log('Website published to the gh-pages branch.');
  } catch (error) {
    console.error('Could not publish the generated website:', error);
    process.exitCode = 1;
  }
}
