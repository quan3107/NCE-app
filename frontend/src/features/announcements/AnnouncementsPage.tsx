/** Routed announcement reader/moderator: shared destination for course and notification links. */
import { Link, useParams } from "react-router-dom";
import { CourseAnnouncements } from "./CourseAnnouncements";
import { useAuthStore } from "@store/authStore";
export function AnnouncementsPage() {
  const { courseId = "" } = useParams();
  const { currentUser } = useAuthStore();
  return (
    <main className="p-4 sm:p-6 lg:p-8 space-y-6">
      <Link
        className="underline"
        to={
          currentUser?.role === "admin"
            ? "/admin/courses"
            : currentUser?.role === "teacher"
              ? "/teacher/courses"
              : "/student/dashboard"
        }
      >
        Back to courses
      </Link>
      <CourseAnnouncements key={courseId} courseId={courseId} />
    </main>
  );
}
