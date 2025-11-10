import { Routes } from '@angular/router';
import { TaskDetailComponent } from './task-detail/task-detail.component';
import { TaskListComponent } from './task-list/task-list.component';

export const taskRoutes: Routes = [
    {
        path: '',
        redirectTo: '/dashboard',
        pathMatch: 'full'
    },
    {
        path: ':id',
        component: TaskDetailComponent
    },
    {
        path: 'list/:projectId',
        component: TaskListComponent
    }
];

