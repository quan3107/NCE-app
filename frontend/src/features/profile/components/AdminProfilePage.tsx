/**
 * Location: features/profile/components/AdminProfilePage.tsx
 * Purpose: Render the administrator's persisted profile editor.
 * Why: Administrators need the same real profile flow as teachers and students.
 */
import { PageHeader } from "@components/common/PageHeader";
import { ProfileDetailsCard } from "./ProfileDetailsCard";

export function AdminProfilePage() {
  return (
    <div>
      <PageHeader
        title="Profile"
        description="Manage your administrator account"
      />
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-2xl">
          <ProfileDetailsCard />
        </div>
      </div>
    </div>
  );
}
