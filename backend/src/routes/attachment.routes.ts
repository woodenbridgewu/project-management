import { Router } from 'express';
import { AttachmentController, upload } from '../controllers/attachment.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
const attachmentController = new AttachmentController();

// 所有附件路由都需要認證
router.use(authenticate);

// 任務附件路由
router.get('/tasks/:taskId/attachments', (req, res) => attachmentController.getAttachmentsByTask(req, res));
router.post('/tasks/:taskId/attachments', upload.single('file'), (req, res) => attachmentController.uploadAttachment(req, res));

// 附件操作路由
router.delete('/:id', (req, res) => attachmentController.deleteAttachment(req, res));

export { router as attachmentRouter };

