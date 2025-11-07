import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { ProjectController } from '../controllers/project.controller';

const router = Router();
const projectController = new ProjectController();

// 所有專案路由都需要認證
router.use(authenticate);

// 專案 CRUD
router.get('/:id', (req, res) => projectController.getProjectById(req, res));
router.patch('/:id', (req, res) => projectController.updateProject(req, res));
router.delete('/:id', (req, res) => projectController.deleteProject(req, res));
router.post('/:id/archive', (req, res) => projectController.archiveProject(req, res));

export { router as projectRouter };

