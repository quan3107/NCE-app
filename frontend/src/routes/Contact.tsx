/**
 * Location: src/routes/Contact.tsx
 * Purpose: Provide the marketing contact route with a simple form submission handler.
 * Why: Keeps contact flow isolated at the routing layer after the refactor.
 */

import { Mail, MapPin, Phone } from 'lucide-react';
import { Button } from '@components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Textarea } from '@components/ui/textarea';
import { toast } from 'sonner@2.0.3';

export function ContactRoute() {
  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    toast.success("Message sent! We'll get back to you soon.");
  };

  return (
    <div className="content-band py-16 sm:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mb-10">
          <h1 className="mb-4 text-4xl font-semibold tracking-normal">Contact Us</h1>
          <p className="text-lg text-muted-foreground">
            Have questions about our IELTS courses or need guidance? We'd love to hear from you. Send us a message and we'll respond within 24 hours.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Send us a message</CardTitle>
                <CardDescription>Whether you're interested in our IELTS courses or have questions about the test, we're here to help</CardDescription>
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
                  <Button type="submit" className="w-full sm:w-auto">Send Message</Button>
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
                    <p className="text-sm text-muted-foreground">support@nce.com</p>
                  </div>
                </div>
                <div className="flex gap-3 rounded-[8px] border bg-background/45 p-3">
                  <Phone className="size-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium mb-1">Phone</p>
                    <p className="text-sm text-muted-foreground">+1 (555) 123-4567</p>
                  </div>
                </div>
                <div className="flex gap-3 rounded-[8px] border bg-background/45 p-3">
                  <MapPin className="size-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium mb-1">Office</p>
                    <p className="text-sm text-muted-foreground">
                      123 Education Street<br />
                      Bangkok, Thailand 10110
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Office Hours</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Monday - Friday</span>
                  <span className="font-medium">9:00 AM - 6:00 PM</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Saturday</span>
                  <span className="font-medium">10:00 AM - 2:00 PM</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sunday</span>
                  <span className="font-medium">Closed</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}



