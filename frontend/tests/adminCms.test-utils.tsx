/**
 * Location: tests/adminCms.test-utils.tsx
 * Purpose: Render the CMS editor inside a data router with a real leave target.
 * Why: Route-blocking behavior is unavailable in React Router's declarative routers.
 */
import { render } from '@testing-library/react';
import React, { useState } from 'react';
import {
  createMemoryRouter,
  Link,
  RouterProvider,
} from 'react-router-dom';

import { AdminCmsPage } from '../src/features/admin/components/AdminCmsPage';

export function renderAdminCmsPage() {
  let refreshRoute = () => undefined;
  function CmsTestRoute() {
    const [, setRevision] = useState(0);
    refreshRoute = () => setRevision((current) => current + 1);
    return (
      <>
        <Link to="/other">Leave CMS</Link>
        <AdminCmsPage />
      </>
    );
  }

  const router = createMemoryRouter(
    [
      {
        path: '/admin/content',
        element: <CmsTestRoute />,
      },
      { path: '/other', element: <p>Other page</p> },
    ],
    { initialEntries: ['/admin/content'] },
  );

  const view = render(<RouterProvider router={router} />);
  return {
    router,
    ...view,
    rerenderPage: refreshRoute,
  };
}
