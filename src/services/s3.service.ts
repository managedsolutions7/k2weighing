import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '@config/env';

const region = env.AWS_REGION || process.env.AWS_REGION || 'ap-south-1';
const bucket = env.S3_UPLOADS_BUCKET || process.env.S3_UPLOADS_BUCKET;
const defaultPrefix = env.S3_UPLOADS_PREFIX || 'uploads';
const kmsKeyId = env.S3_KMS_KEY_ID || process.env.S3_KMS_KEY_ID;

const s3 = new S3Client({ region });

export class S3Service {
  static getUploadsBucket(): string {
    if (!bucket) throw new Error('S3_UPLOADS_BUCKET not configured');
    return bucket;
  }

  static buildKey(pathParts: string[]): string {
    const prefix = defaultPrefix.replace(/\/$/, '');
    const rest = pathParts.map((p) => String(p).replace(/^\/+|\/+$/g, '')).join('/');
    return `${prefix}/${rest}`;
  }

  static async putObject(
    key: string,
    body: Buffer | Uint8Array | string,
    contentType?: string,
  ): Promise<void> {
    const params: any = {
      Bucket: this.getUploadsBucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
      ServerSideEncryption: kmsKeyId ? 'aws:kms' : undefined,
      SSEKMSKeyId: kmsKeyId || undefined,
    };
    await s3.send(new PutObjectCommand(params));
  }

  static async getPresignedGetUrl(
    key: string,
    expiresInSeconds = 900,
    filename?: string,
  ): Promise<string> {
    const params: any = {
      Bucket: this.getUploadsBucket(),
      Key: key,
    };

    if (filename) {
      params.ResponseContentDisposition = `attachment; filename="${filename}"`;
    }

    const cmd = new GetObjectCommand(params);

    return getSignedUrl(s3, cmd, { expiresIn: expiresInSeconds });
  }

  static async headObject(key: string): Promise<any> {
    const params = {
      Bucket: this.getUploadsBucket(),
      Key: key,
    };
    const cmd = new HeadObjectCommand(params);
    return await s3.send(cmd);
  }

  static async deleteObject(key: string): Promise<void> {
    const params = {
      Bucket: this.getUploadsBucket(),
      Key: key,
    };
    const cmd = new DeleteObjectCommand(params);
    await s3.send(cmd);
  }
}
