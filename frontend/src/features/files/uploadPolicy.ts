/**
 * Location: features/files/uploadPolicy.ts
 * Purpose: Define policy shapes and helpers for file upload validation.
 * Why: Keeps policy concerns isolated from upload transport logic.
 */

export type FileUploadLimits = {
  maxFileSize: number;
  maxTotalSize: number;
  maxFilesPerUpload: number;
};

export type FileUploadAllowedType = {
  mimeType: string;
  extensions: string[];
  label: string;
  acceptToken: string;
};

export type FileUploadPolicy = {
  limits: FileUploadLimits;
  allowedTypes: FileUploadAllowedType[];
  accept: string;
  typeLabel: string;
  allowedMimeTypes: ReadonlySet<string>;
  allowedExtensions: ReadonlySet<string>;
};

const FALLBACK_ALLOWED_TYPES: FileUploadAllowedType[] = [
  {
    mimeType: 'application/pdf',
    extensions: ['.pdf'],
    label: 'PDF Document',
    acceptToken: '.pdf',
  },
  {
    mimeType: 'application/msword',
    extensions: ['.doc'],
    label: 'Word Document',
    acceptToken: '.doc',
  },
  {
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    extensions: ['.docx'],
    label: 'Word Document',
    acceptToken: '.docx',
  },
  {
    mimeType: 'audio/*',
    extensions: ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac', '.webm'],
    label: 'Audio Files',
    acceptToken: 'audio/*',
  },
  {
    mimeType: 'image/*',
    extensions: ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'],
    label: 'Image Files',
    acceptToken: 'image/*',
  },
];

const FALLBACK_LIMITS: FileUploadLimits = {
  maxFileSize: 25 * 1024 * 1024,
  maxTotalSize: 100 * 1024 * 1024,
  maxFilesPerUpload: 5,
};

function normalizeExtension(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return '';
  }
  return trimmed.startsWith('.') ? trimmed : `.${trimmed}`;
}

function toTypeToken(type: FileUploadAllowedType): string {
  if (type.acceptToken.startsWith('.')) {
    return type.acceptToken.slice(1).toUpperCase();
  }
  if (type.acceptToken.endsWith('/*')) {
    return type.acceptToken.slice(0, -2);
  }
  return type.label.toLowerCase();
}

function buildTypeLabel(allowedTypes: FileUploadAllowedType[]): string {
  const tokens = allowedTypes.map(toTypeToken).filter((token) => token.length > 0);

  if (tokens.length === 0) {
    return 'files';
  }

  if (tokens.length === 1) {
    return `${tokens[0]} files`;
  }

  if (tokens.length === 2) {
    return `${tokens[0]} or ${tokens[1]} files`;
  }

  const prefix = `${tokens.slice(0, -1).join(', ')}, or ${tokens[tokens.length - 1]}`;
  return `${prefix} files`;
}

export function createFileUploadPolicy({
  limits,
  allowedTypes,
  accept,
  typeLabel,
}: {
  limits: FileUploadLimits;
  allowedTypes: FileUploadAllowedType[];
  accept?: string;
  typeLabel?: string;
}): FileUploadPolicy {
  const normalizedAllowedTypes = allowedTypes.map((type) => ({
    mimeType: type.mimeType.trim().toLowerCase(),
    extensions: type.extensions
      .map(normalizeExtension)
      .filter((extension) => extension.length > 1),
    label: type.label.trim(),
    acceptToken: type.acceptToken.trim(),
  }));

  const allowedMimeTypes = new Set<string>();
  const allowedExtensions = new Set<string>();

  for (const type of normalizedAllowedTypes) {
    allowedMimeTypes.add(type.mimeType);
    for (const extension of type.extensions) {
      allowedExtensions.add(extension);
    }
  }

  return {
    limits,
    allowedTypes: normalizedAllowedTypes,
    accept:
      accept && accept.trim().length > 0
        ? accept
        : normalizedAllowedTypes.map((type) => type.acceptToken).join(','),
    typeLabel:
      typeLabel && typeLabel.trim().length > 0
        ? typeLabel
        : buildTypeLabel(normalizedAllowedTypes),
    allowedMimeTypes,
    allowedExtensions,
  };
}

export const FALLBACK_FILE_UPLOAD_POLICY = createFileUploadPolicy({
  limits: FALLBACK_LIMITS,
  allowedTypes: FALLBACK_ALLOWED_TYPES,
  accept: '.pdf,.doc,.docx,audio/*,image/*',
  typeLabel: 'PDF, DOC, DOCX, audio, or image files',
});

function getFileExtension(fileName: string): string {
  const trimmed = fileName.trim().toLowerCase();
  const lastDot = trimmed.lastIndexOf('.');
  return lastDot >= 0 ? trimmed.slice(lastDot) : '';
}

function mimeMatchesPolicy(mime: string, allowedMimeTypes: ReadonlySet<string>): boolean {
  if (allowedMimeTypes.has(mime)) {
    return true;
  }

  const slashIndex = mime.indexOf('/');
  if (slashIndex <= 0) {
    return false;
  }

  const wildcardMime = `${mime.slice(0, slashIndex)}/*`;
  return allowedMimeTypes.has(wildcardMime);
}

export function isAllowedFile(
  file: Pick<File, 'name' | 'type'>,
  policy: FileUploadPolicy = FALLBACK_FILE_UPLOAD_POLICY,
): { ok: boolean; reason?: string } {
  const extension = getFileExtension(file.name);
  const mime = typeof file.type === 'string' ? file.type.toLowerCase() : '';

  if (mimeMatchesPolicy(mime, policy.allowedMimeTypes)) {
    return { ok: true };
  }

  if (extension.length > 0 && policy.allowedExtensions.has(extension)) {
    return { ok: true };
  }

  return { ok: false, reason: `Unsupported file type: ${file.name}` };
}
