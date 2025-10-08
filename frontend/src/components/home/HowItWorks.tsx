import type { ReactNode } from 'react';

import { Card, CardDescription, CardHeader, CardTitle } from '../ui/card';

type Feature = {
  icon: ReactNode;
  title: string;
  description: string;
};

type HowItWorksProps = {
  features: Feature[];
};

export function HowItWorks({ features }: HowItWorksProps) {
  return (
    <section className="py-20 bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="mb-4">How It Works</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Our structured approach helps you improve systematically across all IELTS test components with expert guidance every
            step of the way.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {features.map(feature => (
            <Card key={feature.title}>
              <CardHeader>
                <div className="size-12 rounded-lg bg-gradient-to-br from-[#E6F0FF] to-[#BFD9FF] flex items-center justify-center mb-4">
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

