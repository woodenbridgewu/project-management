import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { WorkspaceController } from '../controllers/workspace.controller';
import { ProjectController } from '../controllers/project.controller';

const router = Router();
const workspaceController = new WorkspaceController();
const projectController = new ProjectController();

// 所有工作區路由都需要認證
router.use(authenticate);

// 工作區 CRUD
router.get('/', (req, res) => workspaceController.getWorkspaces(req, res));
router.post('/', (req, res) => workspaceController.createWorkspace(req, res));
router.get('/:id', (req, res) => workspaceController.getWorkspaceById(req, res));
router.patch('/:id', (req, res) => workspaceController.updateWorkspace(req, res));
router.delete('/:id', (req, res) => workspaceController.deleteWorkspace(req, res));

// 專案管理（必須放在成員路由之前，避免路由衝突）
router.get('/:workspaceId/projects', (req, res) => projectController.getProjectsByWorkspace(req, res));
router.post('/:workspaceId/projects', (req, res) => projectController.createProject(req, res));

// 成員管理
router.get('/:id/members', (req, res) => workspaceController.getMembers(req, res));
router.post('/:id/members', (req, res) => workspaceController.inviteMember(req, res));
router.patch('/:id/members/:userId', (req, res) => workspaceController.updateMemberRole(req, res));
router.delete('/:id/members/:userId', (req, res) => workspaceController.removeMember(req, res));

export { router as workspaceRouter };

