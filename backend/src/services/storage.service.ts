import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config/index';
import { Readable } from 'stream';
import fs from 'fs';
import path from 'path';

export interface UploadResult {
    url: string;
    key: string;
}

export class StorageService {
    private static s3Client: S3Client | null = null;
    private static isInitialized = false;

    /**
     * 初始化 S3 客戶端
     */
    private static initializeS3Client(): S3Client | null {
        // 如果已經初始化且配置有效，返回現有客戶端
        if (this.isInitialized && this.s3Client) {
            return this.s3Client;
        }

        // 檢查是否啟用 S3/MinIO
        const useS3 = config.storage.enabled;
        if (!useS3) {
            console.log('Storage service disabled, using local storage');
            this.isInitialized = true;
            return null;
        }

        // 檢查必要的配置
        if (!config.storage.endpoint && !config.storage.region) {
            console.warn('Storage service enabled but missing endpoint or region, falling back to local storage');
            this.isInitialized = true;
            return null;
        }

        // 檢查 Access Key 和 Secret Key
        if (!config.storage.accessKeyId || !config.storage.secretAccessKey) {
            console.warn('Storage service enabled but missing STORAGE_ACCESS_KEY_ID or STORAGE_SECRET_ACCESS_KEY, falling back to local storage');
            this.isInitialized = true;
            return null;
        }

        try {
            const s3Config: any = {
                region: config.storage.region || 'us-east-1',
                credentials: {
                    accessKeyId: config.storage.accessKeyId,
                    secretAccessKey: config.storage.secretAccessKey
                }
            };

            // 如果是 MinIO 或自訂端點，需要設定 endpoint 和 forcePathStyle
            if (config.storage.endpoint) {
                s3Config.endpoint = config.storage.endpoint;
                s3Config.forcePathStyle = true; // MinIO 需要這個設定
            }

            this.s3Client = new S3Client(s3Config);
            this.isInitialized = true;
            console.log('Storage service initialized successfully');
            return this.s3Client;
        } catch (error) {
            console.error('Failed to initialize storage service:', error);
            this.isInitialized = true;
            return null;
        }
    }

    /**
     * 上傳檔案到 S3/MinIO
     */
    static async uploadFile(
        filePath: string,
        fileName: string,
        contentType: string,
        folder: string = 'attachments'
    ): Promise<UploadResult> {
        const s3Client = this.initializeS3Client();

        // 如果 S3 未配置，使用本地儲存
        if (!s3Client) {
            return this.uploadToLocal(filePath, fileName, folder);
        }

        try {
            // 讀取檔案
            const fileStream = fs.createReadStream(filePath);
            
            // 生成唯一的檔案鍵（路徑）
            const fileKey = `${folder}/${Date.now()}-${Math.round(Math.random() * 1E9)}-${path.basename(fileName)}`;
            
            // 使用 Upload 類別支援大檔案上傳
            // 注意：Metadata 中的檔名需要是 ASCII 字符，中文字符會導致錯誤
            // 我們將原始檔名進行 Base64 編碼以確保兼容性
            const uploadParams: any = {
                Bucket: config.storage.bucket,
                Key: fileKey,
                Body: fileStream,
                ContentType: contentType
            };

            // 如果檔名包含非 ASCII 字符，進行 Base64 編碼
            // 否則直接使用原始檔名
            if (/[^\x00-\x7F]/.test(fileName)) {
                // 包含非 ASCII 字符，使用 Base64 編碼
                uploadParams.Metadata = {
                    originalName: Buffer.from(fileName, 'utf8').toString('base64'),
                    originalNameEncoded: 'base64'
                };
            } else {
                // 只包含 ASCII 字符，可以直接使用
                uploadParams.Metadata = {
                    originalName: fileName
                };
            }

            const upload = new Upload({
                client: s3Client,
                params: uploadParams
            });

            await upload.done();

            // 生成檔案 URL
            let fileUrl: string;
            if (config.storage.publicUrl) {
                // 使用自訂公開 URL（MinIO 或 CDN）
                // fileKey 格式：attachments/filename.jpg
                // 需要包含 bucket 名稱
                fileUrl = `${config.storage.publicUrl}/${config.storage.bucket}/${fileKey}`;
            } else if (config.storage.endpoint) {
                // MinIO 或自訂端點
                // 格式：http://localhost:9000/bucket/attachments/filename.jpg
                fileUrl = `${config.storage.endpoint}/${config.storage.bucket}/${fileKey}`;
            } else {
                // AWS S3 標準 URL
                fileUrl = `https://${config.storage.bucket}.s3.${config.storage.region}.amazonaws.com/${fileKey}`;
            }

            // 刪除本地暫存檔案
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }

            return {
                url: fileUrl,
                key: fileKey
            };
        } catch (error: any) {
            console.error('[Storage] Failed to upload file to S3/MinIO:', error);
            console.error('[Storage] Error details:', {
                message: error.message,
                code: error.code,
                name: error.name,
                $metadata: error.$metadata
            });
            console.warn('[Storage] Falling back to local storage');
            // 如果 S3 上傳失敗，回退到本地儲存
            return this.uploadToLocal(filePath, fileName, folder);
        }
    }

    /**
     * 上傳檔案到本地儲存（回退方案）
     */
    private static uploadToLocal(
        filePath: string,
        fileName: string,
        folder: string = 'attachments'
    ): UploadResult {
        const uploadDir = path.join(process.cwd(), 'uploads', folder);
        
        // 確保目錄存在
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        // 生成唯一檔名
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(fileName);
        const name = path.basename(fileName, ext);
        const safeName = name.replace(/[^a-zA-Z0-9\u4E00-\u9FFF\s\-_\.]/g, '_');
        const newFileName = `${safeName}-${uniqueSuffix}${ext}`;
        const newFilePath = path.join(uploadDir, newFileName);

        // 移動檔案到目標目錄
        if (filePath !== newFilePath) {
            fs.renameSync(filePath, newFilePath);
        }

        const fileUrl = `/uploads/${folder}/${newFileName}`;
        return {
            url: fileUrl,
            key: `${folder}/${newFileName}`
        };
    }

    /**
     * 從 S3/MinIO 刪除檔案
     */
    static async deleteFile(fileKey: string): Promise<boolean> {
        const s3Client = this.initializeS3Client();

        // 如果 S3 未配置，使用本地儲存刪除
        if (!s3Client) {
            return this.deleteFromLocal(fileKey);
        }

        try {
            const command = new DeleteObjectCommand({
                Bucket: config.storage.bucket,
                Key: fileKey
            });

            await s3Client.send(command);
            console.log(`[Storage] Successfully deleted file from S3/MinIO: ${fileKey}`);
            return true;
        } catch (error: any) {
            console.error(`[Storage] Failed to delete file from S3/MinIO:`, {
                error: error.message,
                code: error.Code || error.code,
                bucket: config.storage.bucket,
                key: fileKey
            });
            // 如果 S3 刪除失敗，嘗試本地刪除（可能是混合模式）
            return this.deleteFromLocal(fileKey);
        }
    }

    /**
     * 從本地儲存刪除檔案
     */
    private static deleteFromLocal(fileKey: string): boolean {
        try {
            // fileKey 可能是完整路徑或相對路徑
            let filePath: string;
            if (fileKey.startsWith('/uploads/')) {
                filePath = path.join(process.cwd(), fileKey);
            } else if (fileKey.startsWith('uploads/')) {
                filePath = path.join(process.cwd(), fileKey);
            } else if (fileKey.startsWith('/')) {
                // 如果以 / 開頭但不是 /uploads/，可能是從 URL 提取的路徑
                filePath = path.join(process.cwd(), 'uploads', fileKey.slice(1));
            } else {
                filePath = path.join(process.cwd(), 'uploads', fileKey);
            }

            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Failed to delete local file:', error);
            return false;
        }
    }

    /**
     * 從 file_url 提取檔案鍵（用於刪除）
     */
    static extractKeyFromUrl(fileUrl: string): string {
        // 如果是完整 URL（S3/MinIO），提取路徑部分
        if (fileUrl.startsWith('http')) {
            try {
                const url = new URL(fileUrl);
                const pathParts = url.pathname.split('/').filter(p => p);
                
                // 對於 MinIO 或自訂端點，路徑格式可能是: /bucket/key
                // 對於 S3，路徑格式可能是: /key（bucket 在域名中）
                // 我們需要移除 bucket 名稱（如果存在）
                
                // 檢查是否使用 publicUrl（CDN），這種情況下路徑格式: /bucket/key
                if (config.storage.publicUrl && fileUrl.startsWith(config.storage.publicUrl)) {
                    const publicPath = fileUrl.replace(config.storage.publicUrl, '');
                    // publicPath 格式可能是: /bucket/key 或 /key
                    const pathWithoutLeadingSlash = publicPath.startsWith('/') ? publicPath.slice(1) : publicPath;
                    const parts = pathWithoutLeadingSlash.split('/');
                    // 如果第一部分是 bucket 名稱，移除它
                    if (parts.length > 1 && parts[0] === config.storage.bucket) {
                        return parts.slice(1).join('/');
                    }
                    return pathWithoutLeadingSlash;
                }
                
                // 檢查是否使用 endpoint（MinIO）
                if (config.storage.endpoint && fileUrl.startsWith(config.storage.endpoint)) {
                    // MinIO 路徑格式: http://endpoint/bucket/key
                    // 移除 bucket 名稱（第一個部分）
                    if (pathParts.length > 1 && pathParts[0] === config.storage.bucket) {
                        return pathParts.slice(1).join('/');
                    }
                    return pathParts.join('/');
                }
                
                // AWS S3 標準格式: https://bucket.s3.region.amazonaws.com/key
                // 路徑直接是 key（bucket 在域名中）
                return pathParts.join('/');
            } catch (error) {
                console.error('[Storage] Failed to parse URL:', fileUrl, error);
                // 如果解析失敗，嘗試簡單提取
                const match = fileUrl.match(/\/attachments\/[^?]+/);
                if (match) {
                    return match[0].replace(/^\//, '');
                }
                return fileUrl;
            }
        }
        
        // 如果是相對路徑（本地儲存），直接返回
        // 例如: /uploads/attachments/file.jpg -> attachments/file.jpg
        if (fileUrl.startsWith('/uploads/')) {
            return fileUrl.replace('/uploads/', '');
        }
        if (fileUrl.startsWith('uploads/')) {
            return fileUrl;
        }
        
        return fileUrl;
    }

    /**
     * 檢查是否使用 S3/MinIO
     */
    static isS3Enabled(): boolean {
        return config.storage.enabled && this.initializeS3Client() !== null;
    }

    /**
     * 從 S3/MinIO 獲取檔案流（用於代理）
     */
    static async getFileStream(fileKey: string): Promise<Readable | null> {
        const s3Client = this.initializeS3Client();
        if (!s3Client) {
            return null;
        }

        try {
            const command = new GetObjectCommand({
                Bucket: config.storage.bucket,
                Key: fileKey
            });

            const response = await s3Client.send(command);
            return response.Body as Readable;
        } catch (error) {
            console.error('[Storage] Failed to get file stream:', error);
            return null;
        }
    }

    /**
     * 生成預簽名 URL（臨時訪問連結，適合私有檔案）
     */
    static async getPresignedUrl(fileKey: string, expiresIn: number = 3600): Promise<string | null> {
        const s3Client = this.initializeS3Client();
        if (!s3Client) {
            return null;
        }

        try {
            const command = new GetObjectCommand({
                Bucket: config.storage.bucket,
                Key: fileKey
            });

            const url = await getSignedUrl(s3Client, command, { expiresIn });
            return url;
        } catch (error) {
            console.error('[Storage] Failed to generate presigned URL:', error);
            return null;
        }
    }
}

