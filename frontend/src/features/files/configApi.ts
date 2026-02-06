/**
 * Location: features/files/configApi.ts
 * Purpose: Fetch role-based file upload policy from backend config endpoints.
 * Why: Keeps upload validation aligned with backend-enforced policy while preserving fallbacks.
 */

import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@lib/apiClient';

import {
  FALLBACK_FILE_UPLOAD_POLICY,
  createFileUploadPolicy,
  type FileUploadPolicy,
} from './uploadPolicy';

type FileUploadLimitsResponse = {
  limits: {
    max_file_size: number;
    max_total_size: number;
    max_files_per_upload: number;
  };
};

type AllowedFileTypesResponse = {
  allowed_types: Array<{
    mime_type: string;
    extensions: string[];
    label: string;
    accept_token: string;
  }>;
  accept: string;
  type_label: string;
};

const FILE_UPLOAD_CONFIG_QUERY_KEY = 'config:file-upload';

function mapToPolicy(
  limitsResponse: FileUploadLimitsResponse,
  allowedTypesResponse: AllowedFileTypesResponse,
): FileUploadPolicy {
  return createFileUploadPolicy({
    limits: {
      maxFileSize: limitsResponse.limits.max_file_size,
      maxTotalSize: limitsResponse.limits.max_total_size,
      maxFilesPerUpload: limitsResponse.limits.max_files_per_upload,
    },
    allowedTypes: allowedTypesResponse.allowed_types.map((type) => ({
      mimeType: type.mime_type,
      extensions: type.extensions,
      label: type.label,
      acceptToken: type.accept_token,
    })),
    accept: allowedTypesResponse.accept,
    typeLabel: allowedTypesResponse.type_label,
  });
}

export async function fetchFileUploadConfig(): Promise<FileUploadPolicy> {
  try {
    const [limitsResponse, allowedTypesResponse] = await Promise.all([
      apiClient<FileUploadLimitsResponse>('/api/v1/config/file-upload-limits'),
      apiClient<AllowedFileTypesResponse>('/api/v1/config/allowed-file-types'),
    ]);

    return mapToPolicy(limitsResponse, allowedTypesResponse);
  } catch {
    return FALLBACK_FILE_UPLOAD_POLICY;
  }
}

export function useFileUploadConfig() {
  return useQuery({
    queryKey: [FILE_UPLOAD_CONFIG_QUERY_KEY],
    queryFn: fetchFileUploadConfig,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });
}
