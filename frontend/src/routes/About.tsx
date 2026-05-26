/**
 * Location: src/routes/About.tsx
 * Purpose: Render the public About route with CMS-managed content and fallback.
 * Why: Keeps static marketing narratives editable in backend without breaking UX during outages.
 */

import { Card, CardDescription, CardHeader, CardTitle } from '@components/ui/card'
import { useAboutPageContentQuery } from '@features/marketing/api'
import { resolveAboutPageContent } from '@features/marketing/contentResolver'
import { getIconComponent } from '@features/marketing/iconMap'

export function AboutRoute() {
  const aboutQuery = useAboutPageContentQuery()
  const content = resolveAboutPageContent(
    aboutQuery.data,
    aboutQuery.error,
    !aboutQuery.isLoading,
  )

  return (
    <div>
      <section className="content-band py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <h1 className="text-4xl sm:text-5xl font-semibold tracking-normal mb-6">{content.hero.title}</h1>
            <p className="text-lg text-muted-foreground">{content.hero.description}</p>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-10 max-w-2xl">
            <h2 className="mb-4 text-3xl font-semibold tracking-normal">Our Values</h2>
            <p className="text-muted-foreground">
              The principles that guide everything we do
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {content.values.map((value, index) => (
              <Card key={`${value.title}-${index}`}>
                <CardHeader>
                  <div className="size-11 rounded-[8px] bg-secondary flex items-center justify-center mb-4">
                    {getIconComponent(value.icon, 'size-6 text-primary')}
                  </div>
                  <CardTitle>{value.title}</CardTitle>
                  <CardDescription>{value.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="content-band py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="quiet-panel max-w-3xl px-6 py-8 sm:px-8">
            <h2 className="mb-4 text-3xl font-semibold tracking-normal">Our Story</h2>
            <div className="space-y-4 text-muted-foreground">
              {content.story.sections.map((section, index) => (
                <p key={index}>{section}</p>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
