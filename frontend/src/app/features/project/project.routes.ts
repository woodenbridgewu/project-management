import { Routes } from '@angular/router';

export const projectRoutes: Routes = [
    {
        path: ':id/board',
        loadComponent: () => import('./project-board/project-board.component').then(m => m.ProjectBoardComponent)
    },
    {
        path: ':id',
        redirectTo: ':id/board',
        pathMatch: 'full'
    }
];

