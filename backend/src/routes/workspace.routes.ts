import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// 所有工作區路由都需要認證
router.use(authenticate);

// TODO: 實作工作區相關路由
// router.get('/', workspaceController.getWorkspaces);
// router.post('/', workspaceController.createWorkspace);
// router.get('/:id', workspaceController.getWorkspaceById);
// router.patch('/:id', workspaceController.updateWorkspace);
// router.delete('/:id', workspaceController.deleteWorkspace);

export { router as workspaceRouter };

