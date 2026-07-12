/**
 * Location: features/admin/components/CmsDraftPreview.tsx
 * Purpose: Render local CMS editor content with the public page presentation primitives.
 * Why: Administrators need visual editorial QA before saving or publishing a draft.
 */
import { Mail, MapPin, Phone } from "lucide-react";

import { HeroSection } from "@components/marketing/HeroSection";
import { HowItWorks } from "@components/marketing/HowItWorks";
import { Button } from "@components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@components/ui/card";
import type { CmsPageContent, CmsPageKey } from "@features/admin/cmsTypes";
import { getIconComponent } from "@features/marketing/iconMap";
import type {
  CmsAboutPageContent,
  CmsContactPageContent,
  CmsHomepageContent,
} from "@lib/backend-schema";

function HomepageDraftPreview({ content }: { content: CmsHomepageContent }) {
  const features = content.howItWorks.features.map((feature) => ({
    ...feature,
    icon: getIconComponent(feature.icon, "size-6 text-primary"),
  }));

  return (
    <section
      aria-label="Homepage draft preview"
      className="overflow-hidden rounded-lg border"
    >
      <HeroSection
        badge={content.hero.badge}
        title={content.hero.title}
        description={content.hero.description}
        ctaPrimary={content.hero.cta_primary}
        ctaSecondary={content.hero.cta_secondary}
        stats={content.stats}
        onViewCourses={() => undefined}
        onTeacherLogin={() => undefined}
      />
      <HowItWorks
        sectionTitle={content.howItWorks.title}
        sectionDescription={content.howItWorks.description}
        features={features}
      />
    </section>
  );
}

function AboutDraftPreview({ content }: { content: CmsAboutPageContent }) {
  return (
    <section
      aria-label="About draft preview"
      className="overflow-hidden rounded-lg border"
    >
      <div className="content-band px-6 py-12">
        <h1 className="mb-4 text-4xl font-semibold tracking-normal">
          {content.hero.title}
        </h1>
        <p className="max-w-3xl text-lg text-muted-foreground">
          {content.hero.description}
        </p>
      </div>
      <div className="space-y-8 px-6 py-12">
        <div>
          <h2 className="mb-4 text-3xl font-semibold tracking-normal">
            Our Values
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {content.values.map((value, index) => (
              <Card key={`${value.title}-${index}`}>
                <CardHeader>
                  <div className="mb-4 flex size-11 items-center justify-center rounded-[8px] bg-secondary">
                    {getIconComponent(value.icon, "size-6 text-primary")}
                  </div>
                  <CardTitle>{value.title}</CardTitle>
                  <CardDescription>{value.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
        <div className="quiet-panel px-6 py-8">
          <h2 className="mb-4 text-3xl font-semibold tracking-normal">
            Our Story
          </h2>
          <div className="space-y-4 text-muted-foreground">
            {content.story.sections.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ContactDraftPreview({ content }: { content: CmsContactPageContent }) {
  const details = [
    { label: "Email", value: content.details.email, icon: Mail },
    { label: "Phone", value: content.details.phone, icon: Phone },
    { label: "Office", value: content.details.address, icon: MapPin },
  ];

  return (
    <section
      aria-label="Contact draft preview"
      className="content-band rounded-lg border px-6 py-12"
    >
      <h1 className="mb-4 text-4xl font-semibold tracking-normal">
        {content.header.title}
      </h1>
      <p className="mb-10 max-w-3xl text-lg text-muted-foreground">
        {content.header.description}
      </p>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{content.form.title}</CardTitle>
            <CardDescription>{content.form.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" disabled>
              {content.form.submitLabel}
            </Button>
          </CardContent>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {details.map(({ label, value, icon: Icon }) => (
                <div
                  key={label}
                  className="flex gap-3 rounded-[8px] border bg-background/45 p-3"
                >
                  <Icon className="mt-0.5 size-5 shrink-0 text-primary" />
                  <div>
                    <p className="mb-1 font-medium">{label}</p>
                    <p className="whitespace-pre-line text-sm text-muted-foreground">
                      {value}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Office Hours</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {content.hours.map((entry) => (
                <div key={entry.label} className="flex justify-between gap-3">
                  <span className="text-muted-foreground">{entry.label}</span>
                  <span className="font-medium">{entry.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}

export function CmsDraftPreview({
  pageKey,
  content,
}: {
  pageKey: CmsPageKey;
  content: CmsPageContent;
}) {
  if (pageKey === "homepage") {
    return <HomepageDraftPreview content={content as CmsHomepageContent} />;
  }
  if (pageKey === "about") {
    return <AboutDraftPreview content={content as CmsAboutPageContent} />;
  }
  return <ContactDraftPreview content={content as CmsContactPageContent} />;
}
