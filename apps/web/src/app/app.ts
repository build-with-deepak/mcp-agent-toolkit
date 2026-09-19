import { Component, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';
import { DemoFooterComponent } from './core/demo-footer.component';
import { DemoHeaderComponent } from './core/demo-header.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, DemoFooterComponent, DemoHeaderComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);

  async logout(): Promise<void> {
    this.auth.logout();
    await this.router.navigateByUrl('/login');
  }
}
