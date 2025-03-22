import React, { ChangeEvent, InputHTMLAttributes } from 'react';
import { Input } from './input';

interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
}

export function FormInput({ label, ...props }: FormInputProps) {
    return (
        <div className="space-y-2">
            {label && (
                <label className="text-sm font-medium" htmlFor={props.id}>
                    {label}
                </label>
            )}
            <Input {...props} />
        </div>
    );
} 