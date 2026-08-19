import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/login/login.component').then((m) => m.LoginComponent),
    title: 'Sign in — MCP Agent Toolkit · build-with-deepak.com',
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/agent/agent.component').then((m) => m.AgentComponent),
    title: 'Agent — MCP Agent Toolkit · build-with-deepak.com',
  },
  { path: '**', redirectTo: '' },
];
