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
        "fixed bottom-20 right-6 z-40 h-14 w-14 rounded-full shadow-glow gradient-primary text-white hover:shadow-primary transition-smooth",
        "md:h-auto md:w-auto md:px-6 md:rounded-full",
        className
      )}
      size="lg"
    >
      <Plus className="w-6 h-6 md:mr-2" />
      <span className="hidden md:inline">{label}</span>
    </Button>
  );
};
