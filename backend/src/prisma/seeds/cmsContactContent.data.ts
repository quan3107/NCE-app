/**
 * File: backend/src/prisma/seeds/cmsContactContent.data.ts
 * Purpose: Hold the initial contact-page CMS sections.
 * Why: Keeps the shared CMS seed fixture under the repository file-size guideline.
 */
import type { CmsSeedPage } from './cmsContent.data.js'

export const CMS_CONTACT_PAGE: CmsSeedPage = {
  pageKey: 'contact',
  label: 'Contact Page',
  sections: [
    {
      sectionKey: 'header',
      label: 'Page Header',
      sortOrder: 0,
      items: [
        {
          itemKey: 'header_main',
          sortOrder: 0,
          contentType: 'header',
          contentJson: {
            title: 'Contact Us',
            description:
              "Have questions about our IELTS courses or need guidance? We'd love to hear from you. Send us a message and we'll respond within 24 hours.",
          },
        },
      ],
    },
    {
      sectionKey: 'form',
      label: 'Contact Form',
      sortOrder: 1,
      items: [
        {
          itemKey: 'form_main',
          sortOrder: 0,
          contentType: 'form',
          contentJson: {
            title: 'Send us a message',
            description:
              "Whether you're interested in our IELTS courses or have questions about the test, we're here to help.",
            submitLabel: 'Send Message',
          },
        },
      ],
    },
    {
      sectionKey: 'details',
      label: 'Contact Information',
      sortOrder: 2,
      items: [
        {
          itemKey: 'details_main',
          sortOrder: 0,
          contentType: 'contact_details',
          contentJson: {
            email: 'support@nce.com',
            phone: '+1 (555) 123-4567',
            address: '123 Education Street\nBangkok, Thailand 10110',
          },
        },
      ],
    },
    {
      sectionKey: 'hours',
      label: 'Office Hours',
      sortOrder: 3,
      items: [
        {
          itemKey: 'hours_1',
          sortOrder: 0,
          contentType: 'office_hours',
          contentJson: { label: 'Monday - Friday', value: '9:00 AM - 6:00 PM' },
        },
        {
          itemKey: 'hours_2',
          sortOrder: 1,
          contentType: 'office_hours',
          contentJson: { label: 'Saturday', value: '10:00 AM - 2:00 PM' },
        },
        {
          itemKey: 'hours_3',
          sortOrder: 2,
          contentType: 'office_hours',
          contentJson: { label: 'Sunday', value: 'Closed' },
        },
      ],
    },
  ],
}
