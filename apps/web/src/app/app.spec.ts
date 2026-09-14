import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { AuthService } from './core/auth.service';
import { routes } from './app.routes';

describe('App', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter(routes),
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('shows the conversion header (name, CV, full profile) even when signed out', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    // The header is the primary funnel back to build-with-deepak.com, so it
    // must be visible on the pre-login gate too, not just once inside the demo.
    expect(compiled.querySelector('.topbar')).toBeTruthy();
    expect(compiled.querySelector('.identity-name')?.textContent).toContain('Deepak Kumar Jha');
    expect(compiled.querySelector('.cv-button')).toBeTruthy();
    expect(compiled.querySelector('.session-badge')).toBeFalsy();
  });

  it('adds a demo-session badge and sign-out control once a token exists', async () => {
    localStorage.setItem('mcp_demo_token', 'header.payload.signature');
    // AuthService reads localStorage at construction; a fresh injector picks
    // up the token we just planted.
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter(routes),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.topbar')).toBeTruthy();
    expect(compiled.querySelector('.session-badge')?.textContent).toContain('Demo session');

    TestBed.inject(AuthService).logout();
    fixture.detectChanges();
    // The header itself stays — only the session-scoped controls go away.
    expect(compiled.querySelector('.topbar')).toBeTruthy();
    expect(compiled.querySelector('.session-badge')).toBeFalsy();
  });

  it('carries the build-with-deepak.com brand footer with socials', async () => {
    
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    const footer = compiled.querySelector('app-brand-footer');
    expect(footer).toBeTruthy();
    expect(footer?.querySelector('img[alt="build-with-deepak.com"]')).toBeTruthy();

    const hrefs = Array.from(footer?.querySelectorAll('a') ?? []).map((a) =>
      a.getAttribute('href'),
    );
    expect(hrefs).toContain('https://www.linkedin.com/in/build-with-deepak');
    expect(hrefs).toContain('https://github.com/build-with-deepak');
    expect(hrefs).toContain('https://build-with-deepak.com');
    expect(hrefs).toContain('mailto:entr.deepakjha@gmail.com');
  });
});
