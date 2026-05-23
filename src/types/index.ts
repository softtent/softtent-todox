// ============================================
// Core Entity Types
// ============================================

export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'guest';
export type ProjectStatus = 'active' | 'completed' | 'archived';
export type TeamRole = 'lead' | 'member';
export type SprintStatus = 'planned' | 'active' | 'completed';
export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'completed';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type SubtaskStatus = 'todo' | 'in_progress' | 'done';
export type NotificationType = 'info' | 'success' | 'warning' | 'error' | 'task' | 'mention';

// ============================================
// User
// ============================================

export interface User {
	id: number;
	name: string;
	email: string;
	avatar: string;
	roles?: string[];
}

// ============================================
// Workspace
// ============================================

export interface Workspace {
	id: number;
	name: string;
	slug: string;
	description: string | null;
	logo: string | null;
	color: string;
	owner_id: number;
	owner?: User;
	is_public: boolean;
	member_role?: WorkspaceRole;
	members_count?: number;
	departments_count?: number;
	members?: WorkspaceMember[];
	created_at: string;
	updated_at: string;
}

export interface WorkspaceMember extends User {
	role: WorkspaceRole;
	joined_at: string;
}

// ============================================
// Department
// ============================================

export interface Department {
	id: number;
	workspace_id: number;
	name: string;
	description: string | null;
	color: string;
	head_id: number | null;
	head: User | null;
	teams_count?: number;
	created_at: string;
	updated_at: string;
}

// ============================================
// Team
// ============================================

export interface Team {
	id: number;
	department_ids: number[];
	workspace_id: number;
	name: string;
	description: string | null;
	color: string;
	avatar: string | null;
	manager_id: number | null;
	manager: User | null;
	departments: { id: number; name: string; color: string }[];
	members?: TeamMember[];
	members_count?: number;
	projects_count?: number;
	created_at: string;
	updated_at: string;
}

export interface TeamMember extends User {
	team_role: TeamRole;
	joined_at: string;
}

// ============================================
// Taxonomy (flexible status / label system)
// ============================================

export interface Taxonomy {
	id: number;
	workspace_id: number | null;
	is_global: boolean;
	name: string;
	type: string;
	slug: string | null;
	color: string;
	icon: string | null;
	position: number;
	is_active: boolean;
	created_at: string;
	updated_at: string;
}

// ============================================
// Project
// ============================================

export interface ProjectTeam {
	id: number;
	name: string;
	color: string;
	department: { name: string };
}

export interface Project {
	id: number;
	team_ids: number[];
	workspace_id: number;
	name: string;
	description: string | null;
	color: string;
	icon: string | null;
	status_id: number | null;
	status: string;
	owner_id: number;
	owner: User;
	teams: ProjectTeam[];
	sprints_count?: number;
	created_at: string;
	updated_at: string;
}

// ============================================
// Sprint
// ============================================

export interface Sprint {
	id: number;
	project_id: number;
	name: string;
	goal: string | null;
	status_id: number | null;
	status: string;
	start_date: string | null;
	end_date: string | null;
	project: { id: number; name: string; color: string };
	tasks_count?: number;
	created_at: string;
	updated_at: string;
}

// ============================================
// Task
// ============================================

export interface TaskLabel {
	id: number;
	name: string;
	color: string;
}

export interface Task {
	id: number;
	sprint_id: number | null;
	project_id: number | null;
	workspace_id: number | null;
	title: string;
	description: string | null;
	status_id: number | null;
	status: string;
	priority: TaskPriority;
	start_date: string | null;
	due_date: string | null;
	position: number;
	is_archived: boolean;
	assignee_id: number | null;
	assignee: User | null;
	creator_id: number;
	creator: User;
	label_ids: number[];
	labels: TaskLabel[];
	subtask_counts?: { total: number; completed: number };
	subtasks?: Subtask[];
	comments?: TaskComment[];
	activities?: TaskActivity[];
	created_at: string;
	updated_at: string;
}

export interface TaskComment {
	id: number;
	task_id: number;
	author_id: number;
	author: User;
	content: string;
	created_at: string;
	updated_at: string;
}

export interface TaskActivity {
	id: number;
	task_id: number;
	task_title?: string;
	user_id: number;
	user: User;
	action: string;
	detail: string | null;
	created_at: string;
}

// ============================================
// Subtask
// ============================================

export interface Subtask {
	id: number;
	task_id: number;
	title: string;
	description: string | null;
	status_id: number | null;
	status: string;
	priority: TaskPriority;
	start_date: string | null;
	due_date: string | null;
	completed: boolean;
	position: number;
	assignee_id: number | null;
	assignee: User | null;
	label_ids: number[];
	labels: TaskLabel[];
	created_at: string;
	updated_at: string;
}

// ============================================
// Notification
// ============================================

export interface Notification {
	id: number;
	user_id: number;
	title: string;
	message: string;
	type: NotificationType;
	is_read: boolean;
	link: string | null;
	meta: Record<string, unknown> | null;
	created_at: string;
}

// ============================================
// Dashboard
// ============================================

export interface TaskStats {
	total: number;
	todo: number;
	in_progress: number;
	review: number;
	completed: number;
	overdue: number;
}

export interface DashboardStats {
	tasks: TaskStats;
	projects: number;
}

// ============================================
// API Response Shapes
// ============================================

export interface ApiResponse<T> {
	success: boolean;
	data: T;
	message?: string;
}

export interface PaginatedResponse<T> {
	items: T[];
	total: number;
	page: number;
	per_page: number;
	total_pages: number;
}

// ============================================
// UI Types
// ============================================

export type ViewMode = 'list' | 'kanban' | 'calendar';

export interface KanbanColumn {
	id: TaskStatus;
	title: string;
	color: string;
	tasks: Task[];
}

export interface TaskFilters {
	status?: TaskStatus[];
	priority?: TaskPriority[];
	assignee_id?: number;
	search?: string;
}

// ============================================
// Form Input Types
// ============================================

export interface CreateWorkspaceInput {
	name: string;
	description?: string;
	color?: string;
	is_public?: boolean;
}

export interface CreateDepartmentInput {
	workspace_id: number;
	name: string;
	description?: string;
	color?: string;
	head_id?: number | null;
}

export interface CreateTeamInput {
	workspace_id: number;
	department_ids: number[];
	name: string;
	description?: string;
	color?: string;
	manager_id?: number | null;
}

export interface CreateProjectInput {
	workspace_id: number;
	team_ids: number[];
	name: string;
	description?: string;
	color?: string;
	label_ids?: number[];
}

export interface CreateSprintInput {
	project_id: number;
	name: string;
	goal?: string;
	start_date?: string;
	end_date?: string;
}

export interface CreateTaskInput {
	workspace_id?: number;
	project_id?: number;
	sprint_id?: number | null;
	title: string;
	description?: string;
	status?: string;
	status_id?: number | null;
	priority?: TaskPriority;
	start_date?: string | null;
	due_date?: string | null;
	assignee_id?: number | null;
	label_ids?: number[];
}

export interface CreateSubtaskInput {
	title: string;
	description?: string;
	status?: string;
	status_id?: number | null;
	priority?: TaskPriority;
	start_date?: string | null;
	due_date?: string | null;
	assignee_id?: number | null;
	label_ids?: number[];
}
