import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { SectionController } from '../controllers/section.controller';

const router = Router();
const sectionController = new SectionController();

// 所有區段路由都需要認證
router.use(authenticate);

// 區段 CRUD
router.get('/projects/:projectId/sections', (req, res) => sectionController.getSectionsByProject(req, res));
router.post('/projects/:projectId/sections', (req, res) => sectionController.createSection(req, res));
router.patch('/:id', (req, res) => sectionController.updateSection(req, res));
router.delete('/:id', (req, res) => sectionController.deleteSection(req, res));
router.post('/:id/reorder', (req, res) => sectionController.reorderSection(req, res));

export { router as sectionRouter };

