import { describe, expect, it } from 'vitest';
import { fakePage } from '../testing.js';
import { MetaTagsParser } from './meta-tags.parser.js';

describe('MetaTagsParser', () => {
  const parser = new MetaTagsParser();

  it('reads OpenGraph tags and the main content', async () => {
    const page = fakePage({
      html: `<html><head>
        <meta property="og:title" content="Barista" />
        <meta property="og:site_name" content="Bean There" />
      </head><body><nav>Home</nav><main><h1>Barista</h1><p>Pull shots.</p></main></body></html>`,
    });

    await expect(parser.parse(page)).resolves.toEqual({
      title: 'Barista',
      company: 'Bean There',
      description: '# Barista\n\nPull shots.',
      url: undefined,
    });
  });

  it('falls back to the page title', async () => {
    const draft = await parser.parse(fakePage({ html: '<title>Welder | Careers</title>' }));
    expect(draft?.title).toBe('Welder | Careers');
  });
});
