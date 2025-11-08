import { Router } from 'express';
import { TagController } from '../controllers/tag.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
const tagController = new TagController();

router.use(authenticate);

// 工作區標籤路由
router.get('/workspaces/:workspaceId/tags', (req, res) => tagController.getTagsByWorkspace(req, res));
router.post('/workspaces/:workspaceId/tags', (req, res) => tagController.createTag(req, res));

// 標籤操作路由
router.patch('/:id', (req, res) => tagController.updateTag(req, res));
router.delete('/:id', (req, res) => tagController.deleteTag(req, res));

// 任務標籤關聯路由
router.post('/tasks/:taskId/tags', (req, res) => tagController.addTagToTask(req, res));
router.delete('/tasks/:taskId/tags/:tagId', (req, res) => tagController.removeTagFromTask(req, res));

export { router as tagRouter };
