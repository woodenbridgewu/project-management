import { Router } from 'express';
import { NotificationController } from '../controllers/notification.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
const notificationController = new NotificationController();

// 所有路由都需要認證
router.use(authenticate);

// 取得通知列表
router.get('/', notificationController.getNotifications.bind(notificationController));

// 取得未讀通知數量
router.get('/unread-count', notificationController.getUnreadCount.bind(notificationController));

// 標記通知為已讀
router.patch('/mark-as-read', notificationController.markAsRead.bind(notificationController));

// 標記所有通知為已讀
router.patch('/mark-all-as-read', notificationController.markAllAsRead.bind(notificationController));

// 刪除通知
router.delete('/:id', notificationController.deleteNotification.bind(notificationController));

export default router;

