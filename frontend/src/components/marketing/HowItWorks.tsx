/**
 * Location: components/marketing/HowItWorks.tsx
 * Purpose: Render the "How It Works" marketing section with CMS-driven copy.
 * Why: Keeps heading, description, and cards editable from backend content.
 */

import type { ReactNode } from 'react';

import { Card, CardDescription, CardHeader, CardTitle } from '@components/ui/card';

type Feature = {
  icon: ReactNode;
  title: string;
  description: string;
};

type HowItWorksProps = {
  sectionTitle: string;
  sectionDescription: string;
  features: Feature[];
};

export function HowItWorks({
  sectionTitle,
  sectionDescription,
  features,
}: HowItWorksProps) {
  return (
    <section className="content-band py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-12 max-w-2xl">
          <h2 className="mb-4 text-3xl font-semibold tracking-normal">{sectionTitle}</h2>
          <p className="text-muted-foreground">{sectionDescription}</p>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {features.map(feature => (
            <Card key={feature.title}>
              <CardHeader>
                <div className="size-11 rounded-[8px] bg-secondary flex items-center justify-center mb-4">
                  {feature.icon}
                </div>
                <CardTitle>{feature.title}</CardTitle>
                <CardDescription>{feature.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}






