import { ReactNode } from 'react';
import { Button } from './ui/button';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from './ui/breadcrumb';
import { useRouter } from '../lib/router';
import { ChevronLeft } from 'lucide-react';

type Breadcrumb = {
  label: string;
  path?: string;
};

type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  showBack?: boolean;
  breadcrumbs?: Breadcrumb[];
};

export function PageHeader({ title, description, actions, showBack, breadcrumbs }: PageHeaderProps) {
  const { navigate, goBack } = useRouter();

  return (
    <div className="border-b bg-card">
      <div className="p-4 sm:p-6 lg:p-8">
        {breadcrumbs && (
          <Breadcrumb className="mb-4">
            <BreadcrumbList>
              {breadcrumbs.map((crumb, index) => (
                <span key={index} className="contents">
                  <BreadcrumbItem>
                    {crumb.path ? (
                      <button
                        onClick={() => navigate(crumb.path!)}
                        className="hover:text-foreground transition-colors"
                      >
                        {crumb.label}
                      </button>
                    ) : (
                      <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                  {index < breadcrumbs.length - 1 && <BreadcrumbSeparator />}
                </span>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        )}

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            {showBack && (
              <Button variant="ghost" size="icon" onClick={goBack}>
                <ChevronLeft className="size-5" />
              </Button>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="mb-1">{title}</h1>
              {description && (
                <p className="text-muted-foreground">{description}</p>
              )}
            </div>
          </div>
          {actions && (
            <div className="flex items-center gap-2 flex-shrink-0">
              {actions}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
