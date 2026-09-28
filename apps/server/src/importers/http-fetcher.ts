import { BadGatewayException, BadRequestException, Injectable } from '@nestjs/common';

const TIMEOUT_MS = 20_000;
const MAX_PAGE_BYTES = 5 * 1024 * 1024;
// Some job board APIs only return the whole board, which can be large.
const MAX_JSON_BYTES = 30 * 1024 * 1024;

// Many job sites serve reduced pages (or nothing) to unknown clients.
const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
};

@Injectable()
export class HttpFetcher {
  text(url: string | URL): Promise<string> {
    return this.request(url, 'text/html,application/xhtml+xml', MAX_PAGE_BYTES);
  }

  async json<T>(url: string | URL): Promise<T> {
    const body = await this.request(url, 'application/json', MAX_JSON_BYTES);
    try {
      return JSON.parse(body) as T;
    } catch {
      throw new BadGatewayException(`Expected JSON from ${HttpFetcher.validate(url).hostname}`);
    }
  }

  private async request(url: string | URL, accept: string, maxBytes: number): Promise<string> {
    const target = HttpFetcher.validate(url);
    let response: Response;
    try {
      response = await fetch(target, {
        headers: { ...BROWSER_HEADERS, Accept: accept },
        redirect: 'follow',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      throw new BadGatewayException(
        `Could not reach ${target.hostname}: ${(error as Error).message}`,
      );
    }

    if (!response.ok) {
      throw new BadGatewayException(`${target.hostname} responded with ${response.status}`);
    }
    const length = Number(response.headers.get('content-length') ?? 0);
    if (length > maxBytes) throw new BadGatewayException('The page is too large to import');

    const body = await response.text();
    if (body.length > maxBytes) throw new BadGatewayException('The page is too large to import');
    return body;
  }

  private static validate(url: string | URL): URL {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new BadRequestException('Only http and https URLs can be imported');
    }
    return parsed;
  }
}
