/** Announcement API: typed persistence with caller-owned request IDs for safe retries. */
import { apiClient } from "@lib/apiClient";

export type Announcement = {
  id: string;
  courseId: string;
  title: string;
  body: string;
  revision: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
export type AnnouncementContent = {
  title: string;
  body: string;
  publish: boolean;
};
const path = (courseId: string) => `/api/v1/courses/${courseId}/announcements`;
export const fetchAnnouncements = (courseId: string, offset: number) =>
  apiClient<{ data: Announcement[]; nextOffset: number | null }>(
    `${path(courseId)}?offset=${offset}`,
    { auth: "required" },
  );
export const createAnnouncement = (
  courseId: string,
  body: AnnouncementContent & { requestId: string },
) =>
  apiClient<Announcement>(path(courseId), {
    auth: "required",
    method: "POST",
    body,
  });
export const editAnnouncement = (
  courseId: string,
  id: string,
  body: AnnouncementContent & { revision: number },
) =>
  apiClient<Announcement>(`${path(courseId)}/${id}`, {
    auth: "required",
    method: "PATCH",
    body,
  });
export const deleteAnnouncement = (courseId: string, id: string) =>
  apiClient<void>(`${path(courseId)}/${id}`, {
    auth: "required",
    method: "DELETE",
  });
