import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
    {
        path: 'auth',
        loadChildren: () => import('./features/auth/auth.routes').then(m => m.authRoutes)
    },
    {
        path: 'dashboard',
        canActivate: [authGuard],
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
    },
    {
        path: 'workspaces',
        canActivate: [authGuard],
        loadChildren: () => import('./features/workspace/workspace.routes').then(m => m.workspaceRoutes)
    },
    {
        path: 'projects',
        canActivate: [authGuard],
        loadChildren: () => import('./features/project/project.routes').then(m => m.projectRoutes)
    },
    {
        path: '',
        redirectTo: '/dashboard',
        pathMatch: 'full'
    },
    {
        path: '**',
        redirectTo: '/dashboard'
    }
];