/**
 * Location: src/routes/RegistrationDetails.tsx
 * Purpose: Render registration consent and account information details.
 * Why: Keeps the registration form focused and within the project file limit.
 */

import { Checkbox } from '@components/ui/checkbox';
import { toast } from 'sonner@2.0.3';

type TermsProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
};

export function RegistrationTerms({ checked, onCheckedChange }: TermsProps) {
  return (
    <div className="flex items-center space-x-2">
      <Checkbox
        id="terms"
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
      />
      <label
        htmlFor="terms"
        className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
      >
        I agree to the{' '}
        <button
          type="button"
          className="text-sm hover:underline"
          onClick={() => toast.info('Terms and Conditions would open here')}
        >
          Terms and Conditions
        </button>{' '}
        and{' '}
        <button
          type="button"
          className="text-sm hover:underline"
          onClick={() => toast.info('Privacy Policy would open here')}
        >
          Privacy Policy
        </button>
      </label>
    </div>
  );
}

export function RegistrationInformation() {
  return (
    <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
      <p className="font-medium mb-1">Registration Information:</p>
      <p>- Students can enroll in courses and submit assignments</p>
      <p>- Teachers can create courses and grade submissions</p>
      <p>- All data is securely encrypted</p>
    </div>
  );
}
