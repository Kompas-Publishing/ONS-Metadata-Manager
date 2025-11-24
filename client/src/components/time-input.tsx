import { Input } from "@/components/ui/input";

interface TimeInputProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  'data-testid'?: string;
}

const formatTimeInput = (input: string): string => {
  // Remove all non-digits
  const digitsOnly = input.replace(/[^0-9]/g, '');
  
  // Don't format if empty
  if (!digitsOnly) return '';
  
  // Build formatted time step by step
  let hours = '';
  let minutes = '';
  let seconds = '';
  
  if (digitsOnly.length >= 1) {
    // First digit of hours
    const h1 = parseInt(digitsOnly[0]);
    if (h1 > 2) {
      // If first digit > 2, reject it (max is 23:59:59)
      return '';
    }
    hours = digitsOnly[0];
  }
  
  if (digitsOnly.length >= 2) {
    // Second digit of hours
    const h2 = parseInt(digitsOnly[1]);
    const hoursNum = parseInt(hours + digitsOnly[1]);
    if (hoursNum > 23) {
      // Don't add second digit if it makes hours > 23
      return hours;
    }
    hours += digitsOnly[1];
  }
  
  if (digitsOnly.length >= 3) {
    // First digit of minutes
    const m1 = parseInt(digitsOnly[2]);
    if (m1 > 5) {
      // If first digit > 5, reject it (max is 59)
      return hours;
    }
    minutes = digitsOnly[2];
  }
  
  if (digitsOnly.length >= 4) {
    // Second digit of minutes (always valid 0-9)
    minutes += digitsOnly[3];
  }
  
  if (digitsOnly.length >= 5) {
    // First digit of seconds
    const s1 = parseInt(digitsOnly[4]);
    if (s1 > 5) {
      // If first digit > 5, reject it (max is 59)
      return hours + ':' + minutes;
    }
    seconds = digitsOnly[4];
  }
  
  if (digitsOnly.length >= 6) {
    // Second digit of seconds (always valid 0-9)
    seconds += digitsOnly[5];
  }
  
  // Build formatted output
  let formatted = hours;
  if (minutes) {
    formatted += ':' + minutes;
  }
  if (seconds) {
    formatted += ':' + seconds;
  }
  
  return formatted;
};

export function TimeInput({ value = '', onChange, placeholder, 'data-testid': dataTestId }: TimeInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    const formatted = formatTimeInput(inputValue);
    onChange(formatted);
  };

  return (
    <Input
      type="text"
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      data-testid={dataTestId}
    />
  );
}
