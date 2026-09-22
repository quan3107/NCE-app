-- File: course announcement migration.
-- Purpose: Persist idempotent publication and its per-channel recipient snapshot.
-- Why: Unique keys enforce retry safety; only backend roles may access this API-owned table.
-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "announcement_id" UUID;

-- CreateTable
CREATE TABLE "course_announcements" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "creator_id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "request_hash" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "published_at" TIMESTAMPTZ,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "course_announcements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "course_announcements_course_id_deleted_at_created_at_idx" ON "course_announcements"("course_id", "deleted_at", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "course_announcements_creator_id_request_id_key" ON "course_announcements"("creator_id", "request_id");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_announcement_id_user_id_channel_key" ON "notifications"("announcement_id", "user_id", "channel");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "course_announcements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_announcements" ADD CONSTRAINT "course_announcements_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE public.course_announcements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.course_announcements FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.course_announcements TO nce_app_authenticated;
GRANT SELECT ON public.course_announcements TO service_role;
CREATE POLICY course_announcements_backend_access ON public.course_announcements
  FOR ALL TO nce_app_authenticated USING (true) WITH CHECK (true);
CREATE POLICY course_announcements_delivery_read ON public.course_announcements
  FOR SELECT TO service_role USING (true);
