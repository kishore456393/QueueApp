import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface FloatingLabelInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string;
}

const FloatingLabelInput = React.forwardRef<HTMLInputElement, FloatingLabelInputProps>(
    ({ className, label, value, ...props }, ref) => {
        const [isFocused, setIsFocused] = useState(false);
        const hasValue = value !== undefined && value !== "" && value !== null;

        return (
            <div className="relative group">
                <Input
                    ref={ref}
                    className={cn(
                        "h-12 px-3 pt-4 pb-1 text-base bg-background border-input transition-colors focus:border-primary peer placeholder:text-transparent rounded-md",
                        className
                    )}
                    placeholder={label} // Placeholder needed for peer-placeholder-shown to work if we used CSS only, but we are using state too for safety
                    onFocus={(e) => {
                        setIsFocused(true);
                        props.onFocus?.(e);
                    }}
                    onBlur={(e) => {
                        setIsFocused(false);
                        props.onBlur?.(e);
                    }}
                    value={value}
                    {...props}
                />
                <label
                    className={cn(
                        "absolute left-3 top-3 text-muted-foreground text-sm transition-all pointer-events-none bg-background px-1",
                        (isFocused || hasValue)
                            ? "top-1 text-xs text-primary"
                            : "top-3.5 text-base text-muted-foreground"
                    )}
                    style={{ pointerEvents: 'none' }}
                >
                    {label}
                </label>
            </div>
        );
    }
);

FloatingLabelInput.displayName = "FloatingLabelInput";

export { FloatingLabelInput };
