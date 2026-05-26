/**
 * Location: components/marketing/CallToAction.tsx
 * Purpose: Render the Call To Action component within the Marketing layer.
 * Why: Supports reuse under the refactored frontend structure.
 */

import { Button } from '@components/ui/button';

type CallToActionProps = {
  onCreateAccount: () => void;
  onContact: () => void;
};

export function CallToAction({ onCreateAccount, onContact }: CallToActionProps) {
  return (
    <section className="py-20">
      <div className="quiet-panel max-w-4xl mx-auto px-6 sm:px-10 lg:px-12 py-12 text-center">
        <h2 className="mb-4 text-3xl font-semibold tracking-normal">Ready to Achieve Your Target Band Score?</h2>
        <p className="text-lg text-muted-foreground mb-8">
          Join hundreds of successful IELTS candidates who achieved their goals with NCE
        </p>
        <div className="flex flex-wrap gap-4 justify-center">
          <Button size="lg" onClick={onCreateAccount}>
            Create Account
          </Button>
          <Button size="lg" variant="outline" onClick={onContact}>
            Contact Us
          </Button>
        </div>
      </div>
    </section>
  );
}






