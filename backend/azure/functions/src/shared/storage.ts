import { BlobServiceClient } from '@azure/storage-blob';

const storageConnectionString = process.env.AzureWebJobsStorage;
const containerName = process.env.VIDEO_STORAGE_CONTAINER || 'videos';

if (!storageConnectionString) {
  throw new Error('AzureWebJobsStorage is required for media uploads');
}

const blobService = BlobServiceClient.fromConnectionString(storageConnectionString);
const container = blobService.getContainerClient(containerName);

const extensionForContentType = (contentType: string) => {
  if (contentType.includes('mp4')) return 'mp4';
  if (contentType.includes('webm')) return 'webm';
  if (contentType.includes('quicktime')) return 'mov';
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg';
  return 'bin';
};

export const parseDataUrl = (value?: string) => {
  if (!value?.startsWith('data:')) return null;

  const match = value.match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
  if (!match) return null;

  const contentType = match[1] || 'application/octet-stream';
  const isBase64 = Boolean(match[2]);
  const payload = match[3] || '';
  const buffer = isBase64 ? Buffer.from(payload, 'base64') : Buffer.from(decodeURIComponent(payload));

  return {
    buffer,
    contentType,
    extension: extensionForContentType(contentType)
  };
};

export const uploadDataUrl = async (folder: string, fileName: string, dataUrl?: string) => {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return null;

  await container.createIfNotExists();

  const blobName = `${folder}/${fileName}.${parsed.extension}`;
  const blockBlob = container.getBlockBlobClient(blobName);
  await blockBlob.uploadData(parsed.buffer, {
    blobHTTPHeaders: {
      blobContentType: parsed.contentType
    }
  });

  return {
    path: blobName,
    contentType: parsed.contentType
  };
};

export const downloadBlob = async (blobName: string) => {
  const blob = container.getBlobClient(blobName);
  const exists = await blob.exists();
  if (!exists) return null;

  const properties = await blob.getProperties();
  const buffer = await blob.downloadToBuffer();
  return {
    buffer,
    contentType: properties.contentType || 'application/octet-stream'
  };
};

export const deleteBlobIfExists = async (blobName?: string) => {
  if (!blobName) return;
  await container.getBlobClient(blobName).deleteIfExists();
};
