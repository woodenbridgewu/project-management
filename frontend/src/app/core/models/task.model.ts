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
    owner_id: string;
    owner_name?: string;
    owner_email?: string;
    project_count?: number | string;
    member_count?: number | string;
    created_at: string | Date;
    updated_at: string | Date;
}

export interface WorkspaceMember {
    id: string;
    user_id: string;
    user_name: string;
    user_email: string;
    user_avatar?: string;
    role: 'owner' | 'admin' | 'member' | 'guest';
    joined_at: string | Date;
}

export interface Project {
    id: string;
    workspace_id: string;
    name: string;
    description?: string;
    color: string;
    icon?: string;
    view_mode: 'list' | 'board' | 'timeline' | 'calendar';
    is_archived: boolean;
    created_by: string;
    creator_name?: string;
    creator_email?: string;
    creator_avatar?: string;
    task_count?: number | string;
    section_count?: number | string;
    workspace_name?: string;
    created_at: string | Date;
    updated_at: string | Date;
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