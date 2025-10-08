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
    <section className="py-20 bg-gradient-to-br from-[#E6F0FF] to-[#BFD9FF]/50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="mb-4">Ready to Achieve Your Target Band Score?</h2>
        <p className="text-xl text-muted-foreground mb-8">
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






