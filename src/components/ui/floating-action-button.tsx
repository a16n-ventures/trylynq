import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FloatingActionButtonProps {
  onClick: () => void;
  className?: string;
  label?: string;
}

export const FloatingActionButton = ({ onClick, className, label = 'Create Event' }: FloatingActionButtonProps) => {
  return (
    <Button
      onClick={onClick}
      className={cn(
        "fixed bottom-20 right-4 mb:10px sm:right-6 z-40 h-12 w-12 sm:h-14 sm:w-14 rounded-full shadow-glow gradient-primary text-white hover:shadow-primary transition-smooth",
        "md:h-auto md:w-auto md:px-6 md:rounded-full",
        className
      )}
      size="lg"
    >
      <Plus className="w-5 h-5 sm:w-6 sm:h-6 md:mr-2" />
      <span className="hidden md:inline">{label}</span>
    </Button>
  );
};
