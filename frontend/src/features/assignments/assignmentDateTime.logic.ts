/**
 * Location: features/assignments/assignmentDateTime.logic.ts
 * Purpose: Convert assignment due dates to and from datetime-local control values.
 * Why: datetime-local expects wall-clock time, while API timestamps represent UTC instants.
 */

const padDatePart = (value: number) => value.toString().padStart(2, '0');

export function toDateTimeLocalValue(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getFullYear();
  const month = padDatePart(date.getMonth() + 1);
  const day = padDatePart(date.getDate());
  const hours = padDatePart(date.getHours());
  const minutes = padDatePart(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function fromDateTimeLocalValue(
  value: string,
  unchangedInstant?: Date | string,
): Date {
  if (unchangedInstant !== undefined) {
    const original =
      unchangedInstant instanceof Date ? unchangedInstant : new Date(unchangedInstant);
    if (
      !Number.isNaN(original.getTime()) &&
      toDateTimeLocalValue(original) === value
    ) {
      return new Date(original.getTime());
    }
  }

  const date = new Date(value);
  return date;
}
