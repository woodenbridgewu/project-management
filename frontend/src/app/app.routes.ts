import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
    // {
    //     path: 'auth',
    //     loadChildren: () => import('./features/auth/auth.routes')
    // },
    // {
    //     path: 'workspaces',
    //     canActivate: [authGuard],
    //     loadChildren: () => import('./features/workspace/workspace.routes')
    // },
    // {
    //     path: 'projects/:id',
    //     canActivate: [authGuard],
    //     loadChildren: () => import('./features/project/project.routes')
    // },
    // {
    //     path: 'dashboard',
    //     canActivate: [authGuard],
    //     loadComponent: () => import('./features/dashboard/dashboard.component')
    // },
    {
        path: '',
        redirectTo: '/dashboard',
        pathMatch: 'full'
    }
];