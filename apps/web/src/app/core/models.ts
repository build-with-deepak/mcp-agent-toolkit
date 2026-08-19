/** Mirrors the API's response shapes — plain interfaces, same reasoning as
 * the sibling demos. */

export interface DemoSession {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
  user: { id: string; name: string; kind: 'demo' };
}
