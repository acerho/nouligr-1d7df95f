import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface TimeInputProps {
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
  disabled?: boolean;
  step?: number; // in minutes, default 30
}

export function TimeInput({ 
  value = '', 
  onChange, 
  className,
  disabled,
  step = 30 
}: TimeInputProps) {
  // Generate time slots based on step
  const timeSlots = React.useMemo(() => {
    const slots: string[] = [];
    const totalMinutes = 24 * 60;
    
    for (let minutes = 0; minutes < totalMinutes; minutes += step) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      const timeString = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
      slots.push(timeString);
    }
    
    return slots;
  }, [step]);

  return (
    <Select 
      value={value} 
      onValueChange={onChange}
      disabled={disabled}
    >
      <SelectTrigger className={cn("w-full font-mono", className)}>
        <SelectValue placeholder="--:--" />
      </SelectTrigger>
      <SelectContent className="max-h-[280px]">
        {timeSlots.map((time) => (
          <SelectItem key={time} value={time} className="font-mono">
            {time}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}