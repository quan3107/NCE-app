/**
 * Location: src/routes/Contact.tsx
 * Purpose: Render the contact route with CMS-published copy and contact details.
 * Why: Keeps public contact content server-managed while submission remains a separate feature.
 */

import { Mail, MapPin, Phone } from 'lucide-react';
import { Button } from '@components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Textarea } from '@components/ui/textarea';
import { toast } from 'sonner@2.0.3';
import { useContactPageContentQuery } from '@features/marketing/api';

export function ContactRoute() {
  const contactQuery = useContactPageContentQuery();
  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    toast.success("Message sent! We'll get back to you soon.");
  };

  if (contactQuery.isLoading) {
    return <div className="content-band px-4 py-16 text-muted-foreground">Loading contact page content...</div>;
  }

  if (contactQuery.error || !contactQuery.data) {
    const message = contactQuery.error instanceof Error
      ? contactQuery.error.message
      : 'The contact page CMS response was empty.';
    return (
      <section className="content-band py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl rounded-[8px] border border-destructive/30 bg-card p-6">
            <h1 className="text-2xl font-semibold text-destructive">Unable to load contact page content.</h1>
            <p className="mt-2 text-sm text-muted-foreground">{message}</p>
          </div>
        </div>
      </section>
    );
  }

  const content = contactQuery.data;

  return (
    <div className="content-band py-16 sm:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mb-10">
          <h1 className="mb-4 text-4xl font-semibold tracking-normal">{content.header.title}</h1>
          <p className="text-lg text-muted-foreground">
            {content.header.description}
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>{content.form.title}</CardTitle>
                <CardDescription>{content.form.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input id="firstName" name="given-name" autoComplete="given-name" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input id="lastName" name="family-name" autoComplete="family-name" required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" name="email" type="email" autoComplete="email" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subject">Subject</Label>
                    <Input id="subject" name="subject" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="message">Message</Label>
                    <Textarea id="message" name="message" rows={6} required />
                  </div>
                  <Button type="submit" className="w-full sm:w-auto">{content.form.submitLabel}</Button>
                </form>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-3 rounded-[8px] border bg-background/45 p-3">
                  <Mail className="size-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium mb-1">Email</p>
                    <p className="text-sm text-muted-foreground">{content.details.email}</p>
                  </div>
                </div>
                <div className="flex gap-3 rounded-[8px] border bg-background/45 p-3">
                  <Phone className="size-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium mb-1">Phone</p>
                    <p className="text-sm text-muted-foreground">{content.details.phone}</p>
                  </div>
                </div>
                <div className="flex gap-3 rounded-[8px] border bg-background/45 p-3">
                  <MapPin className="size-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium mb-1">Office</p>
                    <p className="whitespace-pre-line text-sm text-muted-foreground">{content.details.address}</p>
                  </div>
                </div>
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
      </div>
    </div>
  );
}



