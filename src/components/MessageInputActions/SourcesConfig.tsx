import { Settings2, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverButton,
  PopoverPanel,
  Transition,
} from '@headlessui/react';
import { Fragment } from 'react';

const SourcesConfig = ({
  maxSources,
  setMaxSources,
  maxToken,
  setMaxToken,
}: {
  maxSources: number | undefined;
  setMaxSources: (sources: number | undefined) => void;
  maxToken: number | undefined;
  setMaxToken: (tokens: number | undefined) => void;
}) => {
  const hasCustomConfig = maxSources || maxToken;

  return (
    <Popover className="relative">
      <PopoverButton
        type="button"
        className="text-black/50 dark:text-white/50 rounded-xl hover:bg-light-secondary dark:hover:bg-dark-secondary active:scale-95 transition duration-200 hover:text-black dark:hover:text-white"
      >
        <div className="flex flex-row items-center space-x-1">
          <Settings2 size={20} />
          <p className="text-xs font-medium hidden lg:block">
            {hasCustomConfig ? 'Custom' : 'Config'}
          </p>
          {hasCustomConfig && (
            <ChevronDown size={20} className="-translate-x-1" />
          )}
        </div>
      </PopoverButton>
      <Transition
        as={Fragment}
        enter="transition ease-out duration-150"
        enterFrom="opacity-0 translate-y-1"
        enterTo="opacity-100 translate-y-0"
        leave="transition ease-in duration-150"
        leaveFrom="opacity-100 translate-y-0"
        leaveTo="opacity-0 translate-y-1"
      >
        <PopoverPanel className="absolute z-10 w-72 left-0">
          <div className="bg-light-primary dark:bg-dark-primary border rounded-lg border-light-200 dark:border-dark-200 p-4 space-y-4">
            <div className="space-y-2">
              <div className="flex flex-col space-y-1">
                <label className="text-sm font-medium text-black dark:text-white">
                  Number of Sources
                </label>
                <p className="text-xs text-black/70 dark:text-white/70">
                  Maximum number of sources to retrieve
                </p>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={maxSources || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setMaxSources(value ? parseInt(value) : undefined);
                  }}
                  placeholder="Default: 10"
                  className="w-full px-3 py-2 text-sm bg-light-secondary dark:bg-dark-secondary border border-light-200 dark:border-dark-200 rounded-lg text-black dark:text-white placeholder:text-black/50 dark:placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-[#24A0ED] transition-all"
                />
              </div>
              
              <div className="flex flex-col space-y-1">
                <label className="text-sm font-medium text-black dark:text-white">
                  Maximum Tokens
                </label>
                <p className="text-xs text-black/70 dark:text-white/70">
                  Limit the response length (100-4000)
                </p>
                <input
                  type="number"
                  min="100"
                  max="4000"
                  value={maxToken || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setMaxToken(value ? parseInt(value) : undefined);
                  }}
                  placeholder="Default: Auto"
                  className="w-full px-3 py-2 text-sm bg-light-secondary dark:bg-dark-secondary border border-light-200 dark:border-dark-200 rounded-lg text-black dark:text-white placeholder:text-black/50 dark:placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-[#24A0ED] transition-all"
                />
              </div>
            </div>

            {hasCustomConfig && (
              <div className="pt-2 border-t border-light-200 dark:border-dark-200">
                <button
                  onClick={() => {
                    setMaxSources(undefined);
                    setMaxToken(undefined);
                  }}
                  className="w-full px-3 py-2 text-sm text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white bg-light-secondary dark:bg-dark-secondary hover:bg-light-200 dark:hover:bg-dark-200 rounded-lg transition-all"
                >
                  Reset to Defaults
                </button>
              </div>
            )}
          </div>
        </PopoverPanel>
      </Transition>
    </Popover>
  );
};

export default SourcesConfig;