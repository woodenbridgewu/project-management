export interface User {
    id: string;
    email: string;
    fullName: string;
    avatarUrl?: string;
    timezone?: string;
    createdAt?: string | Date;
    updatedAt?: string | Date;
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
    project_id: string;
    name: string;
    position: number;
    task_count?: number | string;
    created_at: string | Date;
    updated_at: string | Date;
    tasks?: Task[];
}

export interface Task {
    id: string;
    project_id: string;
    section_id?: string;
    parent_task_id?: string;
    title: string;
    description?: string;
    status: 'todo' | 'in_progress' | 'review' | 'done';
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    assignee_id?: string;
    assignee_name?: string;
    assignee_avatar?: string;
    assignee?: User;
    creator_id?: string;
    creator_name?: string;
    creator?: User;
    due_date?: string | Date;
    start_date?: string | Date;
    completed_at?: string | Date;
    position: number;
    estimated_hours?: number;
    actual_hours?: number;
    subtask_count?: number | string;
    comment_count?: number | string;
    attachment_count?: number | string;
    section_name?: string;
    tags?: Tag[];
    created_at: string | Date;
    updated_at: string | Date;
}

export interface Tag {
    id: string;
    workspace_id: string;
    name: string;
    color: string;
    task_count?: number | string;
}

export interface Comment {
    id: string;
    task_id: string;
    user_id: string;
    user: User;
    content: string;
    created_at: string | Date;
    updated_at: string | Date;
}

export interface Attachment {
    id: string;
    task_id: string;
    file_name: string;
    file_size: number;
    file_type: string;
    file_url: string;
    uploaded_by: string;
    uploaded_at: string | Date;
    user?: User;
}

export interface Activity {
    id: string;
    workspace_id: string;
    user_id: string;
    entity_type: string;
    entity_id: string;
    action: string;
    changes?: any;
    created_at: string | Date;
    user?: User;
}