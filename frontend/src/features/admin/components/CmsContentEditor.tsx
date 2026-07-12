/**
 * Location: features/admin/components/CmsContentEditor.tsx
 * Purpose: Render structured homepage, about, and contact CMS draft fields.
 * Why: Administrators need safe forms instead of editing raw JSON snapshots.
 */
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Textarea } from '@components/ui/textarea';
import { Button } from '@components/ui/button';
import type {
  CmsAboutPageContent,
  CmsContactPageContent,
  CmsHomepageContent,
} from '@lib/backend-schema';
import type { CmsPageContent, CmsPageKey } from '../cmsTypes';

type EditorProps = {
  pageKey: CmsPageKey;
  content: CmsPageContent;
  onChange: (content: CmsPageContent) => void;
};

type FieldProps = {
  id: string;
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  multiline?: boolean;
  type?: 'text' | 'number' | 'email';
};

function Field({ id, label, value, onChange, multiline, type = 'text' }: FieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {multiline ? (
        <Textarea id={id} value={value} rows={3} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <Input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4 rounded-lg border p-4">
      <legend className="px-2 font-medium">{title}</legend>
      {children}
    </fieldset>
  );
}

function CollectionActions({ addLabel, removeLabel, onAdd, onRemove }: {
  addLabel?: string;
  removeLabel?: string;
  onAdd?: () => void;
  onRemove?: () => void;
}) {
  return (
    <div className="flex justify-end gap-2">
      {onRemove ? <Button type="button" variant="outline" size="sm" aria-label={removeLabel} onClick={onRemove}>Remove</Button> : null}
      {onAdd ? <Button type="button" variant="outline" size="sm" onClick={onAdd}>{addLabel}</Button> : null}
    </div>
  );
}

function HomepageEditor({
  content,
  onChange,
}: {
  content: CmsHomepageContent;
  onChange: (content: CmsHomepageContent) => void;
}) {
  const hero = (key: keyof CmsHomepageContent['hero'], value: string) =>
    onChange({ ...content, hero: { ...content.hero, [key]: value } });
  return (
    <div className="space-y-5">
      <Section title="Hero">
        <Field id="homepage-badge" label="Hero badge" value={content.hero.badge} onChange={(value) => hero('badge', value)} />
        <Field id="homepage-title" label="Hero title" value={content.hero.title} onChange={(value) => hero('title', value)} />
        <Field id="homepage-description" label="Hero description" value={content.hero.description} multiline onChange={(value) => hero('description', value)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="homepage-primary" label="Primary CTA label" value={content.hero.cta_primary} onChange={(value) => hero('cta_primary', value)} />
          <Field id="homepage-secondary" label="Secondary CTA label" value={content.hero.cta_secondary} onChange={(value) => hero('cta_secondary', value)} />
        </div>
      </Section>
      <Section title="Statistics">
        {content.stats.map((stat, index) => (
          <div key={index} className="grid gap-3 rounded-md bg-muted/40 p-3 sm:grid-cols-3">
            <Field id={`stat-label-${index}`} label={`Statistic ${index + 1} label`} value={stat.label} onChange={(value) => {
              const stats = [...content.stats]; stats[index] = { ...stat, label: value }; onChange({ ...content, stats });
            }} />
            <Field id={`stat-value-${index}`} label={`Statistic ${index + 1} value`} type="number" value={stat.value} onChange={(value) => {
              const stats = [...content.stats]; stats[index] = { ...stat, value: Number(value) }; onChange({ ...content, stats });
            }} />
            <Field id={`stat-suffix-${index}`} label={`Statistic ${index + 1} suffix`} value={stat.suffix ?? ''} onChange={(value) => {
              const stats = [...content.stats]; stats[index] = { ...stat, suffix: value || undefined }; onChange({ ...content, stats });
            }} />
          </div>
        ))}
      </Section>
      <Section title="How it works">
        <Field id="how-title" label="Section title" value={content.howItWorks.title} onChange={(value) => onChange({ ...content, howItWorks: { ...content.howItWorks, title: value } })} />
        <Field id="how-description" label="Section description" value={content.howItWorks.description} multiline onChange={(value) => onChange({ ...content, howItWorks: { ...content.howItWorks, description: value } })} />
        {content.howItWorks.features.map((feature, index) => (
          <div key={index} className="grid gap-3 rounded-md bg-muted/40 p-3 sm:grid-cols-3">
            {(['icon', 'title', 'description'] as const).map((key) => (
              <Field key={key} id={`feature-${index}-${key}`} label={`Feature ${index + 1} ${key}`} value={feature[key]} onChange={(value) => {
                const features = [...content.howItWorks.features]; features[index] = { ...feature, [key]: value };
                onChange({ ...content, howItWorks: { ...content.howItWorks, features } });
              }} />
            ))}
            <CollectionActions removeLabel={`Remove feature ${index + 1}`} onRemove={() => onChange({ ...content, howItWorks: { ...content.howItWorks, features: content.howItWorks.features.filter((_, itemIndex) => itemIndex !== index) } })} />
          </div>
        ))}
        <CollectionActions addLabel="Add feature" onAdd={() => onChange({ ...content, howItWorks: { ...content.howItWorks, features: [...content.howItWorks.features, { icon: '', title: '', description: '' }] } })} />
      </Section>
    </div>
  );
}

function AboutEditor({ content, onChange }: { content: CmsAboutPageContent; onChange: (content: CmsAboutPageContent) => void }) {
  return (
    <div className="space-y-5">
      <Section title="Hero">
        <Field id="about-title" label="Hero title" value={content.hero.title} onChange={(value) => onChange({ ...content, hero: { ...content.hero, title: value } })} />
        <Field id="about-description" label="Hero description" value={content.hero.description} multiline onChange={(value) => onChange({ ...content, hero: { ...content.hero, description: value } })} />
      </Section>
      <Section title="Values">
        {content.values.map((entry, index) => (
          <div key={index} className="grid gap-3 rounded-md bg-muted/40 p-3 sm:grid-cols-3">
            {(['icon', 'title', 'description'] as const).map((key) => (
              <Field key={key} id={`value-${index}-${key}`} label={`Value ${index + 1} ${key}`} value={entry[key]} onChange={(value) => {
                const values = [...content.values]; values[index] = { ...entry, [key]: value }; onChange({ ...content, values });
              }} />
            ))}
            <CollectionActions removeLabel={`Remove value ${index + 1}`} onRemove={() => onChange({ ...content, values: content.values.filter((_, itemIndex) => itemIndex !== index) })} />
          </div>
        ))}
        <CollectionActions addLabel="Add value" onAdd={() => onChange({ ...content, values: [...content.values, { icon: '', title: '', description: '' }] })} />
      </Section>
      <Section title="Story">
        {content.story.sections.map((paragraph, index) => (
          <div key={index} className="space-y-3 rounded-md bg-muted/40 p-3">
            <Field id={`story-${index}`} label={`Paragraph ${index + 1}`} value={paragraph} multiline onChange={(value) => {
              const sections = [...content.story.sections]; sections[index] = value; onChange({ ...content, story: { sections } });
            }} />
            <CollectionActions removeLabel={`Remove paragraph ${index + 1}`} onRemove={() => onChange({ ...content, story: { sections: content.story.sections.filter((_, itemIndex) => itemIndex !== index) } })} />
          </div>
        ))}
        <CollectionActions addLabel="Add story paragraph" onAdd={() => onChange({ ...content, story: { sections: [...content.story.sections, ''] } })} />
      </Section>
    </div>
  );
}

function ContactEditor({ content, onChange }: { content: CmsContactPageContent; onChange: (content: CmsContactPageContent) => void }) {
  const group = <K extends 'header' | 'form' | 'details'>(key: K, field: keyof CmsContactPageContent[K], value: string) =>
    onChange({ ...content, [key]: { ...content[key], [field]: value } });
  return (
    <div className="space-y-5">
      <Section title="Page header">
        <Field id="contact-title" label="Header title" value={content.header.title} onChange={(value) => group('header', 'title', value)} />
        <Field id="contact-description" label="Header description" value={content.header.description} multiline onChange={(value) => group('header', 'description', value)} />
      </Section>
      <Section title="Contact form">
        <Field id="form-title" label="Form title" value={content.form.title} onChange={(value) => group('form', 'title', value)} />
        <Field id="form-description" label="Form description" value={content.form.description} multiline onChange={(value) => group('form', 'description', value)} />
        <Field id="form-submit" label="Submit button label" value={content.form.submitLabel} onChange={(value) => group('form', 'submitLabel', value)} />
      </Section>
      <Section title="Contact information">
        <Field id="contact-email" label="Email" type="email" value={content.details.email} onChange={(value) => group('details', 'email', value)} />
        <Field id="contact-phone" label="Phone" value={content.details.phone} onChange={(value) => group('details', 'phone', value)} />
        <Field id="contact-address" label="Address" value={content.details.address} multiline onChange={(value) => group('details', 'address', value)} />
      </Section>
      <Section title="Office hours">
        {content.hours.map((entry, index) => (
          <div key={index} className="grid gap-3 sm:grid-cols-2">
            {(['label', 'value'] as const).map((key) => (
              <Field key={key} id={`hours-${index}-${key}`} label={`Hours ${index + 1} ${key}`} value={entry[key]} onChange={(value) => {
                const hours = [...content.hours]; hours[index] = { ...entry, [key]: value }; onChange({ ...content, hours });
              }} />
            ))}
            <CollectionActions removeLabel={`Remove office hours ${index + 1}`} onRemove={() => onChange({ ...content, hours: content.hours.filter((_, itemIndex) => itemIndex !== index) })} />
          </div>
        ))}
        <CollectionActions addLabel="Add office hours" onAdd={() => onChange({ ...content, hours: [...content.hours, { label: '', value: '' }] })} />
      </Section>
    </div>
  );
}

export function CmsContentEditor({ pageKey, content, onChange }: EditorProps) {
  if (pageKey === 'homepage') return <HomepageEditor content={content as CmsHomepageContent} onChange={onChange} />;
  if (pageKey === 'about') return <AboutEditor content={content as CmsAboutPageContent} onChange={onChange} />;
  return <ContactEditor content={content as CmsContactPageContent} onChange={onChange} />;
}
