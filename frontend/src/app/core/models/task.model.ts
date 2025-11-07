export interface User {
    id: string;
    email: string;
    fullName: string;
    avatarUrl?: string;
}

export interface Workspace {
    id: string;
    name: string;
    description?: string;
    ownerId: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface Project {
    id: string;
    workspaceId: string;
    name: string;
    description?: string;
    color: string;
    icon?: string;
    viewMode: 'list' | 'board' | 'timeline' | 'calendar';
    isArchived: boolean;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface Section {
    id: string;
    projectId: string;
    name: string;
    position: number;
    tasks?: Task[];
}

export interface Task {
    id: string;
    projectId: string;
    sectionId?: string;
    parentTaskId?: string;
    title: string;
    description?: string;
    status: 'todo' | 'in_progress' | 'review' | 'done';
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    assignee?: User;
    creator: User;
    dueDate?: Date;
    startDate?: Date;
    completedAt?: Date;
    position: number;
    estimatedHours?: number;
    actualHours?: number;
    subtaskCount?: number;
    commentCount?: number;
    attachmentCount?: number;
    tags?: Tag[];
    createdAt: Date;
    updatedAt: Date;
}

export interface Tag {
    id: string;
    workspaceId: string;
    name: string;
    color: string;
}

export interface Comment {
    id: string;
    taskId: string;
    user: User;
    content: string;
    createdAt: Date;
    updatedAt: Date;
}