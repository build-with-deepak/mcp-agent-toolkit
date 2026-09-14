import { Component, computed, input } from '@angular/core';

interface DemoLink {
  key: 'rag' | 'router' | 'agent';
  name: string;
  tagline: string;
  url: string;
  repo: string;
}

/**
 * The build-with-deepak.com brand footer, shared (as a per-repo copy, like
 * the auth module) across all three demo apps.
 *
 * These demos exist as brand promotion for Deepak Kumar Jha — evidence a
 * recruiter can click, not standalone products. So every page carries the
 * route back to the brand: the wordmark, the positioning line, the socials,
 * and cross-links to the sibling demos. The logo sits in a light chip on the
 * dark theme because the artwork is drawn for light backgrounds — the exact
 * pattern build-with-deepak.com's own footer uses.
 */
@Component({
  selector: 'app-brand-footer',
  template: `
    <footer class="brand-footer">
      <div class="brand-inner">
        <a
          class="logo-chip"
          href="https://build-with-deepak.com"
          target="_blank"
          rel="noopener"
          aria-label="build-with-deepak.com home"
        >
          <img src="/build-with-light.png" alt="build-with-deepak.com" class="logo-img" />
        </a>

        <p class="byline">
          Built by <strong>Deepak Kumar Jha</strong> — Technical Lead · Senior Full-Stack Engineer
        </p>
        <p class="stat-line">13 years · Node.js · Angular · React · AWS · GCP</p>
        <p class="availability-line">
          Open to full-time Technical Lead roles — Delhi NCR and Dubai/UAE. Available in 15 days.
        </p>

        <div class="cta-row">
          <a
            class="cta-btn cta-primary"
            href="https://build-with-deepak.com/Deepak_Kumar_Jha_Technical_Lead.pdf"
            target="_blank"
            rel="noopener noreferrer"
          >
            Download CV
          </a>
          <a class="cta-btn" href="mailto:entr.deepakjha@gmail.com">Email</a>
          <a class="cta-btn" href="https://www.linkedin.com/in/build-with-deepak" target="_blank" rel="noopener me">
            LinkedIn
          </a>
          <a class="cta-btn" href="https://build-with-deepak.com" target="_blank" rel="noopener">
            Full Profile
          </a>
        </div>

        <p class="tagline">
          A live demo from the <a href="https://build-with-deepak.com" target="_blank" rel="noopener">build-with-deepak.com</a>
          portfolio — production AI engineering, not prototypes.
        </p>

        <div class="social-row">
          <a href="https://github.com/build-with-deepak" target="_blank" rel="noopener me" aria-label="GitHub" title="GitHub">
            <svg class="icon" fill="currentColor" viewBox="0 0 24 24"><path d="M12 .5C5.65.5.5 5.66.5 12.02c0 5.1 3.3 9.42 7.88 10.95.58.11.79-.25.79-.56 0-.27-.01-1.01-.02-1.98-3.2.69-3.87-1.54-3.87-1.54-.52-1.33-1.28-1.68-1.28-1.68-1.04-.72.08-.7.08-.7 1.15.08 1.75 1.18 1.75 1.18 1.02 1.75 2.68 1.25 3.34.95.1-.74.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.15 1.18a10.9 10.9 0 015.73 0c2.18-1.49 3.14-1.18 3.14-1.18.63 1.59.24 2.76.12 3.05.73.81 1.17 1.84 1.17 3.1 0 4.42-2.7 5.39-5.27 5.67.41.36.78 1.08.78 2.17 0 1.57-.01 2.83-.01 3.22 0 .31.2.68.8.56A11.53 11.53 0 0023.5 12C23.5 5.66 18.35.5 12 .5z"/></svg>
          </a>
          <a href="https://x.com/DeepakBuilds" target="_blank" rel="noopener me" aria-label="X / Twitter" title="X / Twitter">
            <svg class="icon" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          </a>
          <a href="https://build-with-deepak.hashnode.dev" target="_blank" rel="noopener me" aria-label="Blog on Hashnode" title="Blog">
            <svg class="icon" fill="currentColor" viewBox="0 0 24 24"><path d="M22.351 8.019l-6.37-6.37a5.63 5.63 0 00-7.962 0l-6.37 6.37a5.63 5.63 0 000 7.962l6.37 6.37a5.63 5.63 0 007.962 0l6.37-6.37a5.63 5.63 0 000-7.962zM12 15.953a3.953 3.953 0 110-7.906 3.953 3.953 0 010 7.906z"/></svg>
          </a>
        </div>

        <nav class="explore-row" aria-label="More from build-with-deepak.com">
          <a href="https://build-with-deepak.com" target="_blank" rel="noopener">Portfolio</a>
          <a href="https://build-with-deepak.com/case-studies" target="_blank" rel="noopener">Case Studies</a>
          <a href="https://build-with-deepak.com/experience" target="_blank" rel="noopener">Experience</a>
          <a href="https://build-with-deepak.com/contact" target="_blank" rel="noopener">Hire Me</a>
        </nav>

        <p class="suite-label">The live demo suite</p>
        <div class="suite-cards">
          @for (demo of demos; track demo.key) {
            @if (demo.key === current()) {
              <span class="suite-card suite-card-current" aria-current="page">
                <span class="suite-card-badge">You're here</span>
                <span class="suite-card-name">{{ demo.name }}</span>
                <span class="suite-card-tagline">{{ demo.tagline }}</span>
              </span>
            } @else {
              <a class="suite-card" [href]="demo.url" target="_blank" rel="noopener">
                <span class="suite-card-name">{{ demo.name }}</span>
                <span class="suite-card-tagline">{{ demo.tagline }}</span>
              </a>
            }
          }
        </div>
        <a class="source-link" [href]="currentRepo()" target="_blank" rel="noopener">View source on GitHub</a>
      </div>
    </footer>
  `,
  styles: `
    .brand-footer {
      border-top: 1px solid var(--border);
      background: var(--surface);
      margin-top: 3rem;
    }

    .brand-inner {
      max-width: 44rem;
      margin: 0 auto;
      padding: 2.25rem 1.5rem 2rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
      text-align: center;
    }

    .logo-chip {
      display: inline-flex;
      align-items: center;
      background: #f1f5f9;
      border: 1px solid var(--border);
      border-radius: 0.9rem;
      padding: 0.6rem 1rem;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);

      &:hover {
        border-color: var(--accent);
      }
    }

    .logo-img {
      height: 3rem;
      width: auto;
      display: block;
    }

    .byline {
      margin: 0.5rem 0 0;
      font-size: 0.875rem;
      color: var(--text);

      strong {
        font-weight: 700;
      }
    }

    .stat-line {
      margin: 0.35rem 0 0;
      font-size: 0.78rem;
      font-weight: 600;
      color: var(--text-muted);
    }

    .availability-line {
      margin: 0.35rem 0 0;
      font-size: 0.78rem;
      color: var(--success);
      font-weight: 600;
      max-width: 30rem;
      line-height: 1.5;
    }

    .cta-row {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 0.6rem;
      margin-top: 1.1rem;
    }

    .cta-btn {
      padding: 0.5rem 1rem;
      border-radius: 0.6rem;
      border: 1px solid var(--border);
      background: var(--surface-raised);
      color: var(--text);
      font-size: 0.8rem;
      font-weight: 600;
      text-decoration: none;

      &:hover {
        border-color: var(--accent);
        color: var(--accent);
      }
    }

    .cta-primary {
      background: var(--accent);
      border-color: var(--accent);
      color: white;

      &:hover {
        opacity: 0.92;
        color: white;
      }
    }

    .tagline {
      margin: 1.25rem 0 0;
      font-size: 0.8rem;
      color: var(--text-muted);
      line-height: 1.55;

      a {
        color: var(--accent);
        font-weight: 600;
        text-decoration: none;

        &:hover {
          text-decoration: underline;
        }
      }
    }

    .social-row {
      display: flex;
      gap: 1.1rem;
      margin-top: 0.4rem;

      a {
        color: var(--text-muted);
        transition: color 0.15s ease;

        &:hover {
          color: var(--accent);
        }
      }
    }

    .icon {
      height: 1.25rem;
      width: 1.25rem;
      display: block;
    }

    .explore-row {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 0.4rem 1.25rem;
      margin-top: 0.35rem;

      a {
        font-size: 0.8rem;
        font-weight: 600;
        color: var(--text-muted);
        text-decoration: none;

        &:hover {
          color: var(--text);
        }
      }
    }

    .suite-label {
      color: var(--text-muted);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-size: 0.65rem;
      margin: 1.5rem 0 0.75rem;
      padding-top: 1.25rem;
      border-top: 1px solid var(--border);
      width: 100%;
      text-align: center;
    }

    /* The 3-card cross-link row — every demo is reachable from every demo,
       and the one you're already on is unmistakably marked so it reads as
       "a suite of three", not three unrelated pages. */
    .suite-cards {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.6rem;
      width: 100%;
    }

    @media (max-width: 30rem) {
      .suite-cards {
        grid-template-columns: 1fr;
      }
    }

    .suite-card {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
      padding: 0.75rem 0.85rem;
      border-radius: 0.7rem;
      border: 1px solid var(--border);
      background: var(--surface-raised);
      text-decoration: none;
      text-align: left;

      &:hover {
        border-color: var(--accent);
      }
    }

    .suite-card-current {
      border-color: var(--accent);
      background: var(--accent-bg);
    }

    .suite-card-badge {
      align-self: flex-start;
      font-size: 0.6rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--accent);
      background: var(--surface);
      padding: 0.1rem 0.45rem;
      border-radius: 999px;
      margin-bottom: 0.15rem;
    }

    .suite-card-name {
      font-size: 0.8125rem;
      font-weight: 700;
      color: var(--text);
    }

    .suite-card-tagline {
      font-size: 0.7rem;
      color: var(--text-muted);
      line-height: 1.4;
    }

    .source-link {
      display: inline-block;
      margin-top: 0.9rem;
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--text-muted);
      text-decoration: none;

      &:hover {
        color: var(--accent);
      }
    }
  `,
})
export class BrandFooterComponent {
  /** Which demo this footer is rendered inside — marks it in the suite row. */
  readonly current = input.required<DemoLink['key']>();

  readonly demos: DemoLink[] = [
    {
      key: 'rag',
      name: 'Privacy-First RAG',
      tagline: 'Retrieval-augmented answers over your own documents',
      url: 'https://rag.build-with-deepak.com',
      repo: 'https://github.com/build-with-deepak/rag-privacy-first',
    },
    {
      key: 'router',
      name: 'Multi-Model Router',
      tagline: 'Routes each request to the right model by cost and task',
      url: 'https://router.build-with-deepak.com',
      repo: 'https://github.com/build-with-deepak/llm-multi-model-router',
    },
    {
      key: 'agent',
      name: 'MCP Agent',
      tagline: 'An agent wired to real tools — SQL, weather, a calculator',
      url: 'https://agent.build-with-deepak.com',
      repo: 'https://github.com/build-with-deepak/mcp-agent-toolkit',
    },
  ];

  readonly currentRepo = computed(
    () => this.demos.find((demo) => demo.key === this.current())!.repo,
  );
}
