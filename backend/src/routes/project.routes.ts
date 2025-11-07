import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// 所有專案路由都需要認證
router.use(authenticate);

// TODO: 實作專案相關路由
// router.get('/workspaces/:workspaceId/projects', projectController.getProjectsByWorkspace);
// router.post('/workspaces/:workspaceId/projects', projectController.createProject);
// router.get('/:id', projectController.getProjectById);
// router.patch('/:id', projectController.updateProject);
// router.delete('/:id', projectController.deleteProject);
// router.post('/:id/archive', projectController.archiveProject);

export { router as projectRouter };

