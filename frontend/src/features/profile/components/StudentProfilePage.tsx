/**
 * Location: features/profile/components/StudentProfilePage.tsx
 * Purpose: Render the student's persisted account profile.
 * Why: Student profile edits should use the shared authenticated persistence flow.
 */
import { PageHeader } from "@components/common/PageHeader";
import { ProfileDetailsCard } from "./ProfileDetailsCard";

export function StudentProfilePage() {
  return (
    <div>
      <PageHeader title="Profile" description="Manage your account settings" />
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-2xl">
          <ProfileDetailsCard />
        </div>
      </div>
    </div>
  );
}
