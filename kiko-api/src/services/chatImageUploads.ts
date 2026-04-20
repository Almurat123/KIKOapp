// CONTEXT MEMORY
// Updated: 2026-04-20
// Author: Rowan
// Reason: web chat now supports user-uploaded image turns and refreshed chat
//         history must still render the image bubble. Generated-image replies
//         now reuse the same private image boundary so assistant-created images
//         do not live as public provider URLs or oversized DB blobs. This owner
//         therefore provides the private storage boundary for both browser
//         uploads and assistant-generated output assets: browser-to-R2 upload,
//         Redis task bindings, server-side image sanitation, durable private
//         object references in ChatMessage.data, and short-lived signed read
//         URLs for model and UI consumption. Farcaster publication is the one
//         exception that needs a durable public URL because casts embed URLs
//         instead of uploaded binaries; that public copy is opt-in per
//         generated-image task and must not make ordinary web chat images public.
// Goal: let current-turn chat images reach vision-capable models and let
//       assistant-generated image replies remain visible in chat history without
//       persisting image binaries or public image URLs in the main database,
//       while enforcing type/size/dimension safety at the storage boundary, and
//       publish stable public generated-image URLs only for social surfaces that
//       require URL embeds.
// Owns: temporary chat-image upload preparation, Redis binding state, R2 object
//       validation/sanitation, private message attachment metadata for both
//       user uploads and assistant-generated replies, short-lived signed read
//       URLs, opt-in public generated-image publication copies, and post-task
//       Redis cleanup.
// Does Not Own: chat message persistence, UI draft previews, image-provider
//               invocation, or prompt assembly.
// Design Language:
// - Chat images are durable private history assets once the user sends them or the assistant generates them.
// - Store private object references in ChatMessage.data, never public image URLs.
// - Browser uploads should use short-lived presigned PUT URLs.
// - Browser-uploaded objects should be finalized immediately after PUT so send
//   can bind already-sanitized metadata instead of doing heavy image work.
// - Model and history reads should use short-lived signed GET URLs generated only when needed.
// - Farcaster generated-image replies must use durable public URL embeds, not
//   expiring signed preview URLs.
// - Public generated-image URLs should default to an API-owned proxy route so
//   social embeds do not depend on an external CDN path convention.
// - When a generated-image attachment carries a public object key, derive the
//   outbound public URL from that key at read time so legacy stored URLs do not
//   keep publishing stale CDN/OGP links.
// - Public generated-image copies are opt-in by task source; do not publish
//   ordinary web chat images.
// - Strip metadata and normalize image formats before model access.
// - Reject mismatched content types, oversize files, and extreme image dimensions.
// - Task cleanup must remove Redis bindings, not user-sent history images.
// Document Provenance:
// - Source: Cloudflare R2 Presigned URLs docs
// - Kind: official API doc
// - Retrieved: 2026-04-16
// - Applied To: browser upload via presigned PUT and model fetch via signed GET
// - Verification: verified in docs and code
// - Source: Cloudflare R2 Configure CORS docs
// - Kind: official API doc
// - Retrieved: 2026-04-16
// - Applied To: requiring bucket CORS for browser-side presigned uploads
// - Verification: verified in docs and code
// - Source: Cloudflare R2 Object lifecycles docs
// - Kind: official API doc
// - Retrieved: 2026-04-16
// - Applied To: optional expiration guidance for unsent or failed chat uploads, not sent history images
// - Verification: verified in docs and code
// - Source: product correction from operator discussion on 2026-04-16
// - Kind: product doc
// - Retrieved: 2026-04-16
// - Applied To: durable private chat image attachments with regenerated signed previews
// - Verification: verified in code
// - Source: operator request on 2026-04-18 to persist generated-image replies
// - Kind: product doc
// - Retrieved: 2026-04-18
// - Applied To: reusing the same private R2 image boundary for assistant-generated image replies
// - Verification: verified in code
// - Source: operator correction on 2026-04-19 for production-stable Farcaster image embeds
// - Kind: product doc
// - Retrieved: 2026-04-19
// - Applied To: opt-in public generated-image URL publication for Farcaster cast embeds
// - Verification: verified in code
// - Source: operator runtime report on 2026-04-20 showing a Farcaster cast with
//   `Generated.` text and a broken `cdn.kikoapp.app` image embed
// - Kind: runtime observation
// - Retrieved: 2026-04-20
// - Applied To: defaulting Farcaster public generated-image URLs to an API-owned
//   proxy route instead of a deployment-specific CDN path
// - Verification: verified in code
// - Source: operator correction on 2026-04-20 that the Farcaster card was still
//   rendering as an OGP preview instead of a direct image
// - Kind: runtime observation
// - Retrieved: 2026-04-20
// - Applied To: deriving public generated-image URLs from persisted public
//   object keys so legacy stored URLs cannot keep forcing link-card rendering
// - Verification: verified in code
// - Source: /Users/almurat/KiKo/test.txt
// - Kind: runtime observation
// - Retrieved: 2026-04-20
// - Applied To: keeping Farcaster web compatible with its `wrpcd.net` image
//   proxy cache by publishing versioned public generated-image URLs
// - Verification: verified in runtime browser log and code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/social-agent-multimodal-input.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-chat-image-upload-r2-and-model-input.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-generated-image-chat-execution-and-ui.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-farcaster-generated-image-reply-and-watermark.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-20-generated-image-public-proxy-and-task-hydration.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-20-farcaster-public-image-origin-and-message-preservation.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-chat-local-image-composer-base.md
// - /Users/almurat/KiKo/system-journal/conflicts.md

import { randomUUID } from 'node:crypto';
import {
    DeleteObjectCommand,
    GetObjectCommand,
    HeadObjectCommand,
    PutObjectCommand,
    S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import sharp from 'sharp';
import cacheClient from '../cache/cacheClient.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';

export const CHAT_IMAGE_UPLOAD_MAX_COUNT = 4;
export const CHAT_IMAGE_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
export const CHAT_IMAGE_UPLOAD_MAX_DIMENSION = 4096;

const ACCEPTED_UPLOAD_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const PREPARED_UPLOAD_TTL_SECONDS = Math.max(60, Number(process.env.CHAT_IMAGE_UPLOAD_PREPARED_TTL_SECONDS || '900'));
const TASK_BINDING_TTL_SECONDS = Math.max(300, Number(process.env.CHAT_IMAGE_UPLOAD_TASK_TTL_SECONDS || '3600'));
const PRESIGNED_PUT_TTL_SECONDS = Math.max(60, Number(process.env.CHAT_IMAGE_UPLOAD_PUT_TTL_SECONDS || '300'));
const PRESIGNED_GET_TTL_SECONDS = Math.max(300, Number(process.env.CHAT_IMAGE_UPLOAD_GET_TTL_SECONDS || '3600'));
const IMAGE_CACHE_CONTROL = process.env.CHAT_IMAGE_UPLOAD_CACHE_CONTROL || 'private, max-age=3600';
const CHAT_IMAGE_PREFIX = String(process.env.CHAT_IMAGE_UPLOAD_PREFIX || 'chat-uploads').replace(/^\/+|\/+$/g, '');
const CHAT_GENERATED_IMAGE_PREFIX = String(process.env.CHAT_GENERATED_IMAGE_PREFIX || `${CHAT_IMAGE_PREFIX}/generated`).replace(/^\/+|\/+$/g, '');
const CHAT_GENERATED_IMAGE_PUBLIC_PREFIX = String(process.env.CHAT_GENERATED_IMAGE_PUBLIC_PREFIX || `${CHAT_IMAGE_PREFIX}/generated-public`).replace(/^\/+|\/+$/g, '');
const CHAT_GENERATED_IMAGE_PUBLIC_URL_MODE = String(process.env.CHAT_GENERATED_IMAGE_PUBLIC_URL_MODE || 'proxy').trim().toLowerCase();
const CHAT_GENERATED_IMAGE_PUBLIC_DIRECT_BASE_URL = String(process.env.CHAT_GENERATED_IMAGE_PUBLIC_BASE_URL || '').trim().replace(/\/+$/g, '');
const CHAT_GENERATED_IMAGE_PUBLIC_PROXY_BASE_URL = String(
    process.env.CHAT_GENERATED_IMAGE_PUBLIC_PROXY_BASE_URL
    || 'https://api.kikoapp.app/api/chat/generated-images/public'
).trim().replace(/\/+$/g, '');
const GENERATED_IMAGE_PUBLIC_CACHE_CONTROL = process.env.CHAT_GENERATED_IMAGE_PUBLIC_CACHE_CONTROL || 'public, max-age=31536000, immutable';
const MAX_IMAGE_PIXELS = CHAT_IMAGE_UPLOAD_MAX_DIMENSION * CHAT_IMAGE_UPLOAD_MAX_DIMENSION;

type SupportedImageFormat = 'jpeg' | 'png' | 'webp';

interface ChatImageUploadConfig {
    bucket: string;
    endpoint: string;
    accessKeyId: string;
    secretAccessKey: string;
    accountId: string;
}

interface PreparedUploadRecord {
    uploadId: string;
    userId: string;
    objectKey: string;
    originalFileName: string;
    expectedContentType: string;
    expectedSize: number;
    createdAt: string;
    finalizedAt?: string;
    contentType?: string;
    size?: number;
    width?: number | null;
    height?: number | null;
}

export interface TaskImageRecord {
    uploadId: string;
    objectKey: string;
    publicObjectKey?: string | null;
    publicUrl?: string | null;
    originalFileName: string;
    contentType: string;
    size: number;
    width: number | null;
    height: number | null;
}

interface TaskImageBinding {
    taskId: string;
    userId: string;
    createdAt: string;
    images: TaskImageRecord[];
}

export interface ChatImageUploadRequest {
    fileName: string;
    contentType: string;
    size: number;
}

export interface PreparedChatImageUploadIntent {
    uploadId: string;
    uploadUrl: string;
    method: 'PUT';
    headers: {
        'Content-Type': string;
    };
    expiresAt: string;
    maxBytes: number;
}

export interface FinalizedChatImageUpload {
    uploadId: string;
    contentType: string;
    size: number;
    width: number | null;
    height: number | null;
}

export interface ChatImageModelInput {
    url: string;
    sourceLabel: string;
}

export interface ChatImageMessageAttachment {
    id: string;
    objectKey?: string | null;
    publicObjectKey?: string | null;
    publicUrl?: string | null;
    previewUrl?: string | null;
    name: string;
    type: string;
    size: number;
    width: number | null;
    height: number | null;
}

export interface ChatImageClientAttachment {
    id: string;
    previewUrl: string;
    publicUrl?: string | null;
    name: string;
    type: string;
    size: number;
    width?: number | null;
    height?: number | null;
}

class ChatImageUploadError extends Error {
    statusCode: number;

    constructor(message: string, statusCode = 400) {
        super(message);
        this.name = 'ChatImageUploadError';
        this.statusCode = statusCode;
    }
}

let s3Client: S3Client | null = null;

function getPreparedUploadRedisKey(uploadId: string): string {
    return `chat:image-upload:prepared:${uploadId}`;
}

function getTaskBindingRedisKey(taskId: string): string {
    return `chat:image-upload:task:${taskId}`;
}

function normalizeMimeType(input: string): string {
    const normalized = String(input || '').trim().toLowerCase();
    if (normalized === 'image/jpg') return 'image/jpeg';
    return normalized;
}

function normalizeOriginalFileName(input: string): string {
    const trimmed = String(input || '').trim();
    if (!trimmed) return 'image';
    return trimmed.replace(/[^\w.\-()\s]+/g, '_').slice(0, 120) || 'image';
}

function safeUserPathSegment(userId: string): string {
    return String(userId || 'anonymous').replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 96) || 'anonymous';
}

function getChatImageUploadConfig(): ChatImageUploadConfig | null {
    const accountId = String(process.env.CLOUDFLARE_R2_ACCOUNT_ID || process.env.R2_ACCOUNT_ID || '').trim();
    const bucket = String(process.env.CLOUDFLARE_R2_BUCKET || process.env.R2_BUCKET || '').trim();
    const accessKeyId = String(process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID || '').trim();
    const secretAccessKey = String(process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY || '').trim();
    const endpoint = String(
        process.env.CLOUDFLARE_R2_ENDPOINT
        || process.env.R2_ENDPOINT
        || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : ''),
    ).trim();

    if (!accountId || !bucket || !accessKeyId || !secretAccessKey || !endpoint) {
        return null;
    }

    return {
        accountId,
        bucket,
        endpoint,
        accessKeyId,
        secretAccessKey,
    };
}

function getRequiredUploadConfig(): ChatImageUploadConfig {
    const config = getChatImageUploadConfig();
    if (!config) {
        throw new ChatImageUploadError('Chat image uploads are not configured on the server.', 503);
    }
    return config;
}

function getS3Client(): S3Client {
    const config = getRequiredUploadConfig();
    if (!s3Client) {
        s3Client = new S3Client({
            region: 'auto',
            endpoint: config.endpoint,
            credentials: {
                accessKeyId: config.accessKeyId,
                secretAccessKey: config.secretAccessKey,
            },
        });
    }
    return s3Client;
}

function assertUploadRequestShape(files: ChatImageUploadRequest[]): void {
    if (!Array.isArray(files) || files.length === 0) {
        throw new ChatImageUploadError('At least one image is required.');
    }
    if (files.length > CHAT_IMAGE_UPLOAD_MAX_COUNT) {
        throw new ChatImageUploadError(`You can upload up to ${CHAT_IMAGE_UPLOAD_MAX_COUNT} images per message.`);
    }
    for (const file of files) {
        const contentType = normalizeMimeType(file?.contentType || '');
        const size = Number(file?.size || 0);
        if (!ACCEPTED_UPLOAD_MIME_TYPES.has(contentType)) {
            throw new ChatImageUploadError('Unsupported image type. Use PNG, JPG, or WEBP.');
        }
        if (!Number.isFinite(size) || size <= 0) {
            throw new ChatImageUploadError('Image size is invalid.');
        }
        if (size > CHAT_IMAGE_UPLOAD_MAX_BYTES) {
            throw new ChatImageUploadError(`Each image must be ${Math.floor(CHAT_IMAGE_UPLOAD_MAX_BYTES / (1024 * 1024))}MB or smaller.`);
        }
    }
}

async function readPreparedUploadRecord(uploadId: string): Promise<PreparedUploadRecord | null> {
    return cacheClient.getJson<PreparedUploadRecord>(getPreparedUploadRedisKey(uploadId));
}

async function writePreparedUploadRecord(record: PreparedUploadRecord): Promise<void> {
    await cacheClient.setJson(getPreparedUploadRedisKey(record.uploadId), record, PREPARED_UPLOAD_TTL_SECONDS);
}

async function deletePreparedUploadRecord(uploadId: string): Promise<void> {
    await cacheClient.del(getPreparedUploadRedisKey(uploadId));
}

async function writeTaskBinding(binding: TaskImageBinding): Promise<void> {
    await cacheClient.setJson(getTaskBindingRedisKey(binding.taskId), binding, TASK_BINDING_TTL_SECONDS);
}

async function readTaskBinding(taskId: string): Promise<TaskImageBinding | null> {
    return cacheClient.getJson<TaskImageBinding>(getTaskBindingRedisKey(taskId));
}

async function deleteTaskBinding(taskId: string): Promise<void> {
    await cacheClient.del(getTaskBindingRedisKey(taskId));
}

function buildObjectKey(userId: string, uploadId: string): string {
    const dayStamp = new Date().toISOString().slice(0, 10);
    return `${CHAT_IMAGE_PREFIX}/${safeUserPathSegment(userId)}/${dayStamp}/${uploadId}`;
}

function buildGeneratedObjectKey(userId: string, assistantMessageId: string): string {
    const dayStamp = new Date().toISOString().slice(0, 10);
    const sanitizedMessageId = String(assistantMessageId || randomUUID()).replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 120) || randomUUID();
    return `${CHAT_GENERATED_IMAGE_PREFIX}/${safeUserPathSegment(userId)}/${dayStamp}/${sanitizedMessageId}`;
}

function buildGeneratedPublicObjectKey(userId: string, assistantMessageId: string): string {
    const dayStamp = new Date().toISOString().slice(0, 10);
    const sanitizedMessageId = String(assistantMessageId || randomUUID()).replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 120) || randomUUID();
    return `${CHAT_GENERATED_IMAGE_PUBLIC_PREFIX}/farcaster/${safeUserPathSegment(userId)}/${dayStamp}/${sanitizedMessageId}.png`;
}

function buildPublicObjectUrlVersion(objectKey: string): string {
    const lastSegment = String(objectKey || '')
        .split('/')
        .filter(Boolean)
        .pop() || 'image';
    return lastSegment
        .replace(/\.[a-z0-9]+$/i, '')
        .replace(/[^a-zA-Z0-9_-]+/g, '_')
        .slice(0, 120) || 'image';
}

function buildPublicObjectUrl(objectKey: string): string | null {
    const baseUrl = CHAT_GENERATED_IMAGE_PUBLIC_URL_MODE === 'direct'
        ? CHAT_GENERATED_IMAGE_PUBLIC_DIRECT_BASE_URL
        : CHAT_GENERATED_IMAGE_PUBLIC_PROXY_BASE_URL;
    if (!baseUrl) return null;
    const encodedPath = String(objectKey || '')
        .split('/')
        .map((segment) => encodeURIComponent(segment))
        .join('/');
    const version = buildPublicObjectUrlVersion(objectKey);
    return `${baseUrl}/${encodedPath}?v=${encodeURIComponent(version)}`;
}

export function resolveGeneratedImagePublicUrl(attachment: any): string | null {
    const publicObjectKey = String(attachment?.publicObjectKey || '').trim().replace(/^\/+/, '');
    if (publicObjectKey && isPublicGeneratedImageObjectKey(publicObjectKey)) {
        return buildPublicObjectUrl(publicObjectKey)
            || String(attachment?.publicUrl || '').trim()
            || null;
    }
    return String(attachment?.publicUrl || '').trim() || null;
}

export function isPublicGeneratedImageObjectKey(objectKey: string): boolean {
    const normalizedKey = String(objectKey || '').trim().replace(/^\/+/, '');
    return normalizedKey.startsWith(`${CHAT_GENERATED_IMAGE_PUBLIC_PREFIX}/`);
}

async function headObjectWithRetry(objectKey: string, attempts = 4): Promise<{ contentLength: number; contentType: string } | null> {
    const client = getS3Client();
    const { bucket } = getRequiredUploadConfig();
    for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
            const head = await client.send(new HeadObjectCommand({
                Bucket: bucket,
                Key: objectKey,
            }));
            return {
                contentLength: Number(head.ContentLength || 0),
                contentType: normalizeMimeType(String(head.ContentType || '')),
            };
        } catch (error) {
            if (attempt === attempts - 1) {
                return null;
            }
            await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
        }
    }
    return null;
}

async function getObjectBuffer(objectKey: string): Promise<Buffer> {
    const client = getS3Client();
    const { bucket } = getRequiredUploadConfig();
    const response = await client.send(new GetObjectCommand({
        Bucket: bucket,
        Key: objectKey,
    }));
    const bytes = await response.Body?.transformToByteArray();
    return Buffer.from(bytes || []);
}

async function putObjectBuffer(objectKey: string, body: Buffer, contentType: string, cacheControl = IMAGE_CACHE_CONTROL): Promise<void> {
    const client = getS3Client();
    const { bucket } = getRequiredUploadConfig();
    await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        Body: body,
        ContentType: contentType,
        CacheControl: cacheControl,
    }));
}

async function deleteObjectQuietly(objectKey: string): Promise<void> {
    try {
        const client = getS3Client();
        const { bucket } = getRequiredUploadConfig();
        await client.send(new DeleteObjectCommand({
            Bucket: bucket,
            Key: objectKey,
        }));
    } catch (error) {
        logger.warn(LogCode.SYS_INFO, 'Chat image upload cleanup failed to delete object', {
            objectKey,
            error: error instanceof Error ? error.message : String(error),
        });
    }
}

function resolveNormalizedOutputFormat(inputFormat: SupportedImageFormat): { format: 'jpeg' | 'png'; contentType: string } {
    if (inputFormat === 'jpeg') {
        return { format: 'jpeg', contentType: 'image/jpeg' };
    }
    return { format: 'png', contentType: 'image/png' };
}

async function sanitizeImageBufferToTaskRecord(params: {
    uploadId: string;
    objectKey: string;
    publicObjectKey?: string | null;
    publicUrl?: string | null;
    originalFileName: string;
    objectBuffer: Buffer;
    preferredContentType?: string | null;
}): Promise<TaskImageRecord> {
    const objectBuffer = params.objectBuffer;
    if (objectBuffer.length === 0) {
        throw new ChatImageUploadError('Uploaded image could not be read from storage.');
    }
    if (objectBuffer.length > CHAT_IMAGE_UPLOAD_MAX_BYTES) {
        throw new ChatImageUploadError(`Each image must be ${Math.floor(CHAT_IMAGE_UPLOAD_MAX_BYTES / (1024 * 1024))}MB or smaller.`);
    }

    const metadata = await sharp(objectBuffer, { limitInputPixels: MAX_IMAGE_PIXELS }).metadata();
    const inputFormat = String(metadata.format || '').toLowerCase() as SupportedImageFormat;
    if (!inputFormat || !['jpeg', 'png', 'webp'].includes(inputFormat)) {
        throw new ChatImageUploadError('Uploaded file is not a supported image.');
    }

    const width = Number(metadata.width || 0);
    const height = Number(metadata.height || 0);
    if (!width || !height) {
        throw new ChatImageUploadError('Uploaded image has invalid dimensions.');
    }

    const output = resolveNormalizedOutputFormat(inputFormat);
    let pipeline = sharp(objectBuffer, { limitInputPixels: MAX_IMAGE_PIXELS })
        .rotate()
        .resize({
            width: CHAT_IMAGE_UPLOAD_MAX_DIMENSION,
            height: CHAT_IMAGE_UPLOAD_MAX_DIMENSION,
            fit: 'inside',
            withoutEnlargement: true,
        });

    const sanitizedBuffer = output.format === 'jpeg'
        ? await pipeline.jpeg({ quality: 90, mozjpeg: true }).toBuffer()
        : await pipeline.png({ compressionLevel: 9 }).toBuffer();

    if (sanitizedBuffer.length > CHAT_IMAGE_UPLOAD_MAX_BYTES) {
        throw new ChatImageUploadError('Image is too large after normalization. Please upload a smaller image.');
    }

    const sanitizedMeta = await sharp(sanitizedBuffer, { limitInputPixels: MAX_IMAGE_PIXELS }).metadata();
    if ((sanitizedMeta.width || 0) > CHAT_IMAGE_UPLOAD_MAX_DIMENSION || (sanitizedMeta.height || 0) > CHAT_IMAGE_UPLOAD_MAX_DIMENSION) {
        throw new ChatImageUploadError(`Images must be ${CHAT_IMAGE_UPLOAD_MAX_DIMENSION}px or smaller on each side.`);
    }

    await putObjectBuffer(params.objectKey, sanitizedBuffer, output.contentType);
    if (params.publicObjectKey && params.publicUrl) {
        await putObjectBuffer(params.publicObjectKey, sanitizedBuffer, output.contentType, GENERATED_IMAGE_PUBLIC_CACHE_CONTROL);
    }

    return {
        uploadId: params.uploadId,
        objectKey: params.objectKey,
        publicObjectKey: params.publicObjectKey || null,
        publicUrl: params.publicUrl || null,
        originalFileName: params.originalFileName,
        contentType: output.contentType,
        size: sanitizedBuffer.length,
        width: sanitizedMeta.width || null,
        height: sanitizedMeta.height || null,
    };
}

async function sanitizeStoredImage(record: PreparedUploadRecord): Promise<TaskImageRecord> {
    const objectBuffer = await getObjectBuffer(record.objectKey);
    return sanitizeImageBufferToTaskRecord({
        uploadId: record.uploadId,
        objectKey: record.objectKey,
        originalFileName: record.originalFileName,
        objectBuffer,
        preferredContentType: record.expectedContentType,
    });
}

function isPreparedUploadFinalized(record: PreparedUploadRecord): boolean {
    return Boolean(record.finalizedAt && record.contentType && record.size && record.size > 0);
}

function taskImageRecordFromPrepared(record: PreparedUploadRecord): TaskImageRecord {
    return {
        uploadId: record.uploadId,
        objectKey: record.objectKey,
        originalFileName: record.originalFileName,
        contentType: record.contentType || record.expectedContentType,
        size: Number(record.size || record.expectedSize || 0),
        width: record.width ?? null,
        height: record.height ?? null,
    };
}

async function assertUploadedObjectMatchesPrepared(record: PreparedUploadRecord): Promise<void> {
    const head = await headObjectWithRetry(record.objectKey);
    if (!head) {
        throw new ChatImageUploadError('One or more images did not finish uploading. Please try again.');
    }
    if (!ACCEPTED_UPLOAD_MIME_TYPES.has(head.contentType)) {
        throw new ChatImageUploadError('Uploaded file type does not match the allowed image types.');
    }
    if (head.contentLength <= 0 || head.contentLength > CHAT_IMAGE_UPLOAD_MAX_BYTES) {
        throw new ChatImageUploadError(`Each image must be ${Math.floor(CHAT_IMAGE_UPLOAD_MAX_BYTES / (1024 * 1024))}MB or smaller.`);
    }
    if (record.expectedSize > 0 && head.contentLength !== record.expectedSize) {
        throw new ChatImageUploadError('Uploaded image size did not match the selected file.');
    }
}

async function finalizePreparedUploadRecord(record: PreparedUploadRecord): Promise<TaskImageRecord> {
    if (isPreparedUploadFinalized(record)) {
        return taskImageRecordFromPrepared(record);
    }

    await assertUploadedObjectMatchesPrepared(record);
    const image = await sanitizeStoredImage(record);
    await writePreparedUploadRecord({
        ...record,
        finalizedAt: new Date().toISOString(),
        contentType: image.contentType,
        size: image.size,
        width: image.width,
        height: image.height,
    });
    return image;
}

function toFinalizedChatImageUpload(image: TaskImageRecord): FinalizedChatImageUpload {
    return {
        uploadId: image.uploadId,
        contentType: image.contentType,
        size: image.size,
        width: image.width,
        height: image.height,
    };
}

function buildSignedReadLabel(image: TaskImageRecord, index: number): string {
    const baseName = image.originalFileName ? ` (${image.originalFileName})` : '';
    return `Uploaded image ${index + 1}${baseName}`;
}

function readAttachmentObjectKey(attachment: any): string {
    return String(
        attachment?.objectKey
        || attachment?.storageObjectKey
        || attachment?.storage?.objectKey
        || ''
    ).trim();
}

function readAttachmentName(attachment: any, index: number): string {
    return String(
        attachment?.name
        || attachment?.originalFileName
        || `image-${index + 1}`
    ).trim();
}

function readAttachmentType(attachment: any): string {
    return normalizeMimeType(String(
        attachment?.type
        || attachment?.contentType
        || 'image/png'
    ));
}

async function createSignedReadUrl(objectKey: string, contentType: string): Promise<string> {
    const client = getS3Client();
    const { bucket } = getRequiredUploadConfig();
    return getSignedUrl(client, new GetObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        ResponseContentType: contentType,
        ResponseCacheControl: IMAGE_CACHE_CONTROL,
    }), {
        expiresIn: PRESIGNED_GET_TTL_SECONDS,
    });
}

export function isChatImageUploadConfigured(): boolean {
    return getChatImageUploadConfig() !== null;
}

export function supportsChatImageModel(model: string): boolean {
    const normalized = String(model || '').trim().toLowerCase();
    if (!normalized) return false;
    if (normalized.startsWith('gpt') || normalized.startsWith('o')) return true;
    if (normalized.includes('grok')) return true;
    return normalized.includes('kimi');
}

export async function prepareChatImageUploads(params: {
    userId: string;
    files: ChatImageUploadRequest[];
}): Promise<PreparedChatImageUploadIntent[]> {
    assertUploadRequestShape(params.files);
    const client = getS3Client();
    const { bucket } = getRequiredUploadConfig();

    logger.info(LogCode.SYS_INFO, 'Chat image uploads: prepare start', {
        userId: params.userId,
        bucket,
        fileCount: params.files.length,
        files: params.files.map((file) => ({
            fileName: normalizeOriginalFileName(file.fileName),
            contentType: normalizeMimeType(file.contentType),
            size: Number(file.size || 0),
        })),
    });

    const uploads = await Promise.all(params.files.map(async (file) => {
        const uploadId = randomUUID();
        const contentType = normalizeMimeType(file.contentType);
        const objectKey = buildObjectKey(params.userId, uploadId);
        const uploadUrl = await getSignedUrl(client, new PutObjectCommand({
            Bucket: bucket,
            Key: objectKey,
            ContentType: contentType,
            CacheControl: IMAGE_CACHE_CONTROL,
        }), {
            expiresIn: PRESIGNED_PUT_TTL_SECONDS,
        });

        await writePreparedUploadRecord({
            uploadId,
            userId: params.userId,
            objectKey,
            originalFileName: normalizeOriginalFileName(file.fileName),
            expectedContentType: contentType,
            expectedSize: Number(file.size || 0),
            createdAt: new Date().toISOString(),
        });

        return {
            uploadId,
            uploadUrl,
            method: 'PUT' as const,
            headers: {
                'Content-Type': contentType,
            },
            expiresAt: new Date(Date.now() + PRESIGNED_PUT_TTL_SECONDS * 1000).toISOString(),
            maxBytes: CHAT_IMAGE_UPLOAD_MAX_BYTES,
        };
    }));

    logger.info(LogCode.SYS_INFO, 'Chat image uploads: prepare complete', {
        userId: params.userId,
        bucket,
        fileCount: uploads.length,
        uploadIds: uploads.map((upload) => upload.uploadId),
        putTtlSeconds: PRESIGNED_PUT_TTL_SECONDS,
    });

    return uploads;
}

export async function discardPreparedChatImageUploads(params: {
    userId: string;
    uploadIds: string[];
}): Promise<void> {
    const uploadIds = Array.from(new Set((params.uploadIds || []).map((value) => String(value || '').trim()).filter(Boolean)));
    await Promise.all(uploadIds.map(async (uploadId) => {
        const record = await readPreparedUploadRecord(uploadId);
        if (!record || record.userId !== params.userId) return;
        await deleteObjectQuietly(record.objectKey);
        await deletePreparedUploadRecord(uploadId);
    }));
}

export async function finalizePreparedChatImageUploads(params: {
    userId: string;
    uploadIds: string[];
}): Promise<FinalizedChatImageUpload[]> {
    const uploadIds = Array.from(new Set((params.uploadIds || []).map((value) => String(value || '').trim()).filter(Boolean)));
    if (uploadIds.length === 0) return [];
    if (uploadIds.length > CHAT_IMAGE_UPLOAD_MAX_COUNT) {
        throw new ChatImageUploadError(`You can upload up to ${CHAT_IMAGE_UPLOAD_MAX_COUNT} images per message.`);
    }

    logger.info(LogCode.SYS_INFO, 'Chat image uploads: finalize start', {
        userId: params.userId,
        uploadCount: uploadIds.length,
        uploadIds,
    });

    const preparedRecords: PreparedUploadRecord[] = [];
    for (const uploadId of uploadIds) {
        const record = await readPreparedUploadRecord(uploadId);
        if (!record || record.userId !== params.userId) {
            throw new ChatImageUploadError('One or more image uploads are invalid or expired.');
        }
        preparedRecords.push(record);
    }

    try {
        const finalized = await Promise.all(preparedRecords.map((record) => finalizePreparedUploadRecord(record)));
        logger.info(LogCode.SYS_INFO, 'Chat image uploads: finalize complete', {
            userId: params.userId,
            imageCount: finalized.length,
            images: finalized.map((image) => ({
                uploadId: image.uploadId,
                contentType: image.contentType,
                size: image.size,
                width: image.width,
                height: image.height,
            })),
        });
        return finalized.map(toFinalizedChatImageUpload);
    } catch (error) {
        await Promise.all(preparedRecords.map((record) => deleteObjectQuietly(record.objectKey)));
        await Promise.all(preparedRecords.map((record) => deletePreparedUploadRecord(record.uploadId)));
        logger.warn(LogCode.SYS_INFO, 'Chat image uploads: finalize failed', {
            userId: params.userId,
            uploadCount: uploadIds.length,
            error: error instanceof Error ? error.message : String(error),
        });
        throw error;
    }
}

export async function bindPreparedChatImageUploadsToTask(params: {
    userId: string;
    taskId: string;
    uploadIds: string[];
}): Promise<TaskImageRecord[]> {
    const uploadIds = Array.from(new Set((params.uploadIds || []).map((value) => String(value || '').trim()).filter(Boolean)));
    if (uploadIds.length === 0) return [];
    if (uploadIds.length > CHAT_IMAGE_UPLOAD_MAX_COUNT) {
        throw new ChatImageUploadError(`You can upload up to ${CHAT_IMAGE_UPLOAD_MAX_COUNT} images per message.`);
    }

    logger.info(LogCode.SYS_INFO, 'Chat image uploads: bind start', {
        userId: params.userId,
        taskId: params.taskId,
        uploadCount: uploadIds.length,
        uploadIds,
    });

    const preparedRecords: PreparedUploadRecord[] = [];
    for (const uploadId of uploadIds) {
        const record = await readPreparedUploadRecord(uploadId);
        if (!record || record.userId !== params.userId) {
            throw new ChatImageUploadError('One or more image uploads are invalid or expired.');
        }
        preparedRecords.push(record);
    }

    const boundImages: TaskImageRecord[] = [];
    try {
        for (const record of preparedRecords) {
            boundImages.push(await finalizePreparedUploadRecord(record));
        }

        await writeTaskBinding({
            taskId: params.taskId,
            userId: params.userId,
            createdAt: new Date().toISOString(),
            images: boundImages,
        });

        await Promise.all(preparedRecords.map((record) => deletePreparedUploadRecord(record.uploadId)));

        logger.info(LogCode.SYS_INFO, 'Chat image uploads: bind complete', {
            userId: params.userId,
            taskId: params.taskId,
            imageCount: boundImages.length,
            images: boundImages.map((image) => ({
                uploadId: image.uploadId,
                contentType: image.contentType,
                size: image.size,
                width: image.width,
                height: image.height,
            })),
        });
        return boundImages;
    } catch (error) {
        await Promise.all(preparedRecords.map((record) => deleteObjectQuietly(record.objectKey)));
        await Promise.all(preparedRecords.map((record) => deletePreparedUploadRecord(record.uploadId)));
        logger.warn(LogCode.SYS_INFO, 'Chat image uploads: bind failed', {
            userId: params.userId,
            taskId: params.taskId,
            uploadCount: uploadIds.length,
            error: error instanceof Error ? error.message : String(error),
        });
        throw error;
    }
}

export function buildChatImageMessageAttachments(images: TaskImageRecord[]): ChatImageMessageAttachment[] {
    return images.map((image, index) => ({
        id: image.uploadId || `image-${index + 1}`,
        objectKey: image.objectKey,
        publicObjectKey: image.publicObjectKey || null,
        publicUrl: image.publicUrl || null,
        name: image.originalFileName || `image-${index + 1}`,
        type: image.contentType,
        size: image.size,
        width: image.width,
        height: image.height,
    }));
}

export async function hydrateChatImageAttachmentListForClient(attachments: any[]): Promise<ChatImageClientAttachment[]> {
    if (!Array.isArray(attachments) || attachments.length === 0) {
        return [];
    }

    const hydratedAttachments = await Promise.all(attachments.map(async (attachment: any, index: number): Promise<ChatImageClientAttachment | null> => {
        const objectKey = readAttachmentObjectKey(attachment);
        const name = readAttachmentName(attachment, index);
        const type = readAttachmentType(attachment);
        const baseAttachment = {
            id: String(attachment?.id || attachment?.uploadId || `image-${index + 1}`),
            name,
            type,
            size: Number(attachment?.size || 0),
            width: attachment?.width ?? null,
            height: attachment?.height ?? null,
            publicUrl: resolveGeneratedImagePublicUrl(attachment),
        };

        if (!objectKey) {
            const previewUrl = String(attachment?.previewUrl || attachment?.url || '').trim();
            return previewUrl ? { ...baseAttachment, previewUrl } : null;
        }

        try {
            const previewUrl = await createSignedReadUrl(objectKey, type);
            return {
                ...baseAttachment,
                previewUrl,
            };
        } catch (error) {
            logger.warn(LogCode.SYS_INFO, 'Chat image uploads: failed to sign history attachment', {
                attachmentId: baseAttachment.id,
                objectKey,
                error: error instanceof Error ? error.message : String(error),
            });
            return null;
        }
    }));

    return hydratedAttachments.filter((attachment): attachment is ChatImageClientAttachment => Boolean(attachment));
}

export async function hydrateChatImageAttachmentsForClient(data: any): Promise<any> {
    const attachments = data?.attachments;
    if (!Array.isArray(attachments) || attachments.length === 0) {
        return data;
    }

    const hydratedAttachments = await hydrateChatImageAttachmentListForClient(attachments);

    return {
        ...(data || {}),
        attachments: hydratedAttachments,
    };
}

export async function hydrateGeneratedChatImageDataForClient(data: any): Promise<any> {
    const generatedImage = data?.generatedImage;
    const images = generatedImage?.images;
    if (!generatedImage || !Array.isArray(images) || images.length === 0) {
        return data;
    }

    const hydratedImages = await hydrateChatImageAttachmentListForClient(images);
    return {
        ...(data || {}),
        generatedImage: {
            ...generatedImage,
            images: hydratedImages,
        },
    };
}

export async function loadTaskChatImageInputs(taskId: string): Promise<ChatImageModelInput[]> {
    const binding = await readTaskBinding(taskId);
    if (!binding || !Array.isArray(binding.images) || binding.images.length === 0) {
        logger.info(LogCode.SYS_INFO, 'Chat image uploads: load skipped', {
            taskId,
            reason: 'no_task_binding',
        });
        return [];
    }

    const { bucket } = getRequiredUploadConfig();

    logger.info(LogCode.SYS_INFO, 'Chat image uploads: load start', {
        taskId,
        userId: binding.userId,
        imageCount: binding.images.length,
    });

    const modelInputs = await Promise.all(binding.images.map(async (image, index) => {
        const url = await createSignedReadUrl(image.objectKey, image.contentType);
        return {
            url,
            sourceLabel: buildSignedReadLabel(image, index),
        };
    }));

    logger.info(LogCode.SYS_INFO, 'Chat image uploads: load complete', {
        taskId,
        userId: binding.userId,
        bucket,
        imageCount: modelInputs.length,
        getTtlSeconds: PRESIGNED_GET_TTL_SECONDS,
    });

    return modelInputs;
}

export async function storeGeneratedChatImage(params: {
    userId: string;
    assistantMessageId: string;
    buffer: Buffer;
    contentType?: string | null;
    fileName?: string | null;
    publishPublic?: boolean;
}): Promise<TaskImageRecord> {
    const userId = String(params.userId || '').trim();
    const assistantMessageId = String(params.assistantMessageId || '').trim();
    if (!userId) {
        throw new ChatImageUploadError('Generated image storage requires user id.', 500);
    }
    if (!assistantMessageId) {
        throw new ChatImageUploadError('Generated image storage requires assistant message id.', 500);
    }
    const objectKey = buildGeneratedObjectKey(userId, assistantMessageId);
    const publicObjectKey = params.publishPublic ? buildGeneratedPublicObjectKey(userId, assistantMessageId) : null;
    const publicUrl = publicObjectKey ? buildPublicObjectUrl(publicObjectKey) : null;
    if (params.publishPublic && !publicUrl) {
        throw new ChatImageUploadError('Generated image public URL base is not configured for social publishing.', 503);
    }
    const uploadId = `generated-${assistantMessageId}`;
    const originalFileName = normalizeOriginalFileName(params.fileName || 'generated-image');
    return sanitizeImageBufferToTaskRecord({
        uploadId,
        objectKey,
        publicObjectKey,
        publicUrl,
        originalFileName,
        objectBuffer: Buffer.from(params.buffer || []),
        preferredContentType: params.contentType || undefined,
    });
}

export async function loadPublicGeneratedChatImageObject(objectKey: string): Promise<{
    body: Buffer;
    contentType: string;
    cacheControl: string;
}> {
    const normalizedKey = String(objectKey || '').trim().replace(/^\/+/, '');
    if (!normalizedKey || !isPublicGeneratedImageObjectKey(normalizedKey)) {
        throw new ChatImageUploadError('Generated image not found.', 404);
    }

    const head = await headObjectWithRetry(normalizedKey, 2);
    if (!head) {
        throw new ChatImageUploadError('Generated image not found.', 404);
    }

    const body = await getObjectBuffer(normalizedKey);
    if (!body.length) {
        throw new ChatImageUploadError('Generated image not found.', 404);
    }

    return {
        body,
        contentType: normalizeMimeType(head.contentType) || 'image/png',
        cacheControl: GENERATED_IMAGE_PUBLIC_CACHE_CONTROL,
    };
}

export async function cleanupTaskChatImageUploads(taskId: string, options: { deleteObjects?: boolean } = {}): Promise<void> {
    const binding = await readTaskBinding(taskId);
    if (!binding) {
        logger.info(LogCode.SYS_INFO, 'Chat image uploads: cleanup skipped', {
            taskId,
            reason: 'no_task_binding',
        });
        return;
    }
    logger.info(LogCode.SYS_INFO, 'Chat image uploads: cleanup start', {
        taskId,
        userId: binding.userId,
        imageCount: binding.images?.length || 0,
        deleteObjects: options.deleteObjects === true,
    });
    if (options.deleteObjects === true) {
        await Promise.all((binding.images || []).map((image) => deleteObjectQuietly(image.objectKey)));
    }
    await deleteTaskBinding(taskId);
    logger.info(LogCode.SYS_INFO, 'Chat image uploads: cleanup complete', {
        taskId,
        userId: binding.userId,
        imageCount: binding.images?.length || 0,
        storageRetained: options.deleteObjects !== true,
    });
}

export function isChatImageUploadError(error: unknown): error is ChatImageUploadError {
    return error instanceof ChatImageUploadError;
}
