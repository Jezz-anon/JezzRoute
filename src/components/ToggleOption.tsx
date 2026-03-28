import React from 'react';

interface ToggleOptionProps {
  label: string;
  description: string;
  icon: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

const ToggleOption: React.FC<ToggleOptionProps> = ({
  label,
  description,
  icon,
  checked,
  onChange,
}) => {
  return (
    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl hover:from-orange-50 hover:to-orange-100 transition-all duration-200 border border-gray-200 hover:border-orange-300">
      <div className="flex items-center gap-3 flex-1">
        <span className="text-2xl">{icon}</span>
        <div className="flex-1">
          <label className="text-sm font-semibold text-gray-800 cursor-pointer block">
            {label}
          </label>
          <p className="text-xs text-gray-600">{description}</p>
        </div>
      </div>
      
      <button
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-7 w-14 items-center rounded-full transition-all duration-300 ml-3 flex-shrink-0 ${
          checked ? 'bg-gradient-to-r from-orange-400 to-orange-600 shadow-lg shadow-orange-200' : 'bg-gray-300'
        }`}
        role="switch"
        aria-checked={checked}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white transition-all duration-300 shadow-md ${
            checked ? 'translate-x-7' : 'translate-x-1'
          }`}
        />
        <input
          type="checkbox"
          checked={checked}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.checked)}
          className="sr-only peer"
          aria-checked={checked}
        />
        <span className="sr-only">
          {checked ? 'On' : 'Off'}
        </span>
      </button>
    </div>
  );
};

export default ToggleOption;
