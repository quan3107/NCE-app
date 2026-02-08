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
      <section className="bg-gradient-to-br from-[#E6F0FF] via-[#BFD9FF]/30 to-background py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <h1 className="text-4xl sm:text-5xl mb-6">{content.hero.title}</h1>
            <p className="text-xl text-muted-foreground">{content.hero.description}</p>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="mb-4">Our Values</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              The principles that guide everything we do
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {content.values.map((value, index) => (
              <Card key={`${value.title}-${index}`}>
                <CardHeader>
                  <div className="size-12 rounded-lg bg-gradient-to-br from-[#E6F0FF] to-[#BFD9FF] flex items-center justify-center mb-4">
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

      <section className="py-20 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="mb-4">Our Story</h2>
            <div className="max-w-3xl mx-auto space-y-4 text-muted-foreground">
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
