import { Routes } from '@angular/router';

export const workspaceRoutes: Routes = [
    {
        path: '',
        loadComponent: () => import('./workspace-list/workspace-list.component').then(m => m.WorkspaceListComponent)
    },
    {
        path: ':id',
        loadComponent: () => import('./workspace-detail/workspace-detail.component').then(m => m.WorkspaceDetailComponent)
    }
];

